import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { adminComplaintAcceptSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

function getProviderDisplayName(
  provider?: {
    name?: string;
    businessName?: string | null;
  } | null,
): string {
  const name = provider?.name?.trim();
  const businessName = provider?.businessName?.trim();

  if (
    name &&
    businessName &&
    name.toLowerCase() !== businessName.toLowerCase()
  ) {
    return `${name} (${businessName})`;
  }

  return name || businessName || "Provider";
}

/**
 * POST /api/admin/complaints/:id/accept
 * Accept a complaint and set response deadline for provider
 *
 * Flow:
 * 1. Validate admin auth
 * 2. Check complaint exists and is in 'open' status
 * 3. Update status to 'accepted'
 * 4. Set response deadline (default 7 days)
 * 5. Create system message
 * 6. Create in-app notifications for seeker and provider
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:complaints:accept",
      max: 40,
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid complaint id" },
        { status: 400 },
      );
    }

    const session = await requireAdminWithDbCheck();

    // Parse body (optional deadline customization)
    let deadlineDays = 7;
    try {
      const body = await req.json();
      const parsed = adminComplaintAcceptSchema.safeParse(body);
      if (parsed.success) {
        deadlineDays = parsed.data.deadlineDays;
      }
    } catch {
      // Empty body is fine, use default
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 },
      );
    }

    // Only open or legacy status complaints can be accepted
    // Known completed statuses that should not be re-accepted
    const completedStatuses = ["accepted", "in_review", "resolved", "rejected"];
    if (completedStatuses.includes(complaint.status)) {
      return NextResponse.json(
        { error: `Cannot accept complaint with status: ${complaint.status}` },
        { status: 400 },
      );
    }

    // Calculate response deadline
    const now = new Date();
    const responseDeadline = new Date(now);
    responseDeadline.setDate(responseDeadline.getDate() + deadlineDays);

    // Update complaint
    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          status: "accepted",
          acceptedAt: now,
          response_deadline: responseDeadline,
        },
      },
    );

    // Get seeker/provider details for system message + notifications
    const [seeker, provider] = await Promise.all([
      db.collection("seekers").findOne({ _id: complaint.seeker_id }),
      db.collection("providers").findOne({ _id: complaint.provider_id }),
    ]);
    const seekerName = seeker?.name || "Customer";
    const providerDisplayName = getProviderDisplayName(
      provider as { name?: string; businessName?: string | null } | null,
    );

    // Create system message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: new ObjectId(session.user.id),
      sender_role: "system",
      message_type: "SYSTEM",
      content: `Admin has accepted this complaint. ${seekerName}'s issue with ${providerDisplayName} is now under review. Provider has ${deadlineDays} days to respond.`,
      createdAt: now,
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    const notifications = [
      {
        recipient_id: complaint.seeker_id,
        recipient_role: "seeker",
        complaint_id: complaintId,
        category: "complaint_accepted",
        title: "Complaint accepted by admin",
        message: `Your complaint is now accepted and under review. Provider response deadline: ${responseDeadline.toLocaleDateString()}.`,
        read: false,
        createdAt: now,
      },
      {
        recipient_id: complaint.provider_id,
        recipient_role: "provider",
        complaint_id: complaintId,
        category: "complaint_accepted",
        title: "Complaint requires your response",
        message: `An admin accepted complaint from ${seekerName}. Please respond by ${responseDeadline.toLocaleDateString()}.`,
        read: false,
        createdAt: now,
      },
    ];

    await db.collection("notifications").insertMany(notifications);

    logger.info("ADMIN_COMPLAINTS", "Complaint accepted", {
      complaintId: id,
      adminId: session.user.id,
      responseDeadline: responseDeadline.toISOString(),
      notificationsCreated: notifications.length,
    });

    return NextResponse.json({
      success: true,
      status: "accepted",
      response_deadline: responseDeadline,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ADMIN_COMPLAINTS", "Error accepting complaint", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
