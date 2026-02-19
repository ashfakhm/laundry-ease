import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { adminComplaintAccessSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:complaints:access",
      max: 40,
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid complaint id" }, { status: 400 });
    }

    const session = await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminComplaintAccessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid access data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { granted } = parsed.data;
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint)
      return NextResponse.json({ error: "Not Found" }, { status: 404 });

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return NextResponse.json(
        { error: "Cannot update provider access after complaint is finalized" },
        { status: 409 },
      );
    }

    if (granted && complaint.status !== "accepted" && complaint.status !== "in_review") {
      return NextResponse.json(
        { error: "Complaint must be accepted before granting provider access" },
        { status: 409 },
      );
    }

    if (!ObjectId.isValid(String(complaint.provider_id))) {
      return NextResponse.json(
        { error: "Complaint provider reference is invalid" },
        { status: 409 },
      );
    }
    const providerObjectId = new ObjectId(String(complaint.provider_id));

    const updatePayload: Record<string, unknown> = {
      $set: {
        provider_access_granted: granted,
        status: granted
          ? "in_review"
          : complaint.status === "in_review"
            ? "accepted"
            : complaint.status,
      },
    };

    if (granted) {
      updatePayload.$addToSet = { participants: providerObjectId };
    }

    // Update Access
    await db.collection("complaints").updateOne({ _id: complaintId }, updatePayload);

    // System Message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: new ObjectId(session.user.id), // Admin ID
      sender_role: "system",
      message_type: "SYSTEM",
      content: granted
        ? "Admin added Provider to the chat."
        : "Admin revoked Provider access.",
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true, granted });
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

    logger.error("ADMIN_COMPLAINTS", "Error updating access", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
