import { successResponse } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:complaints:add-provider",
      max: 40,
      windowMs: 5 * 60 * 1000,
    });

    const session = await requireAdminWithDbCheck();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: "Invalid complaint ID"
      }, {
        status: 400
      });
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json({
        success: false,
        error: "Not Found"
      }, {
        status: 404
      });
    }

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return NextResponse.json({
        success: false,
        error: "Cannot add provider after complaint is finalized"
      }, {
        status: 409
      });
    }

    if (complaint.status !== "accepted" && complaint.status !== "in_review") {
      return NextResponse.json({
        success: false,
        error: "Complaint must be accepted before adding provider"
      }, {
        status: 409
      });
    }

    // Check if provider already has access
    if (complaint.provider_access_granted) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: "Provider already added"
      }, {
        status: 200
      });
    }

    if (!ObjectId.isValid(String(complaint.provider_id))) {
      return NextResponse.json({
        success: false,
        error: "Complaint provider reference is invalid"
      }, {
        status: 409
      });
    }
    const providerObjectId = new ObjectId(String(complaint.provider_id));

    // Update complaint to grant provider access and change status to in_review
    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          provider_access_granted: true,
          status: "in_review", // Move to in_review when provider is added
        },
        $addToSet: { participants: providerObjectId }, // Add to participants if not present
      },
    );

    // Get provider name for system message
    const provider = await db
      .collection("providers")
      .findOne({ _id: providerObjectId });
    const providerName = provider?.businessName || provider?.name || "Provider";

    // Insert system message
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: new ObjectId(session.user.id),
      sender_role: "system",
      message_type: "SYSTEM",
      content: `${providerName} has been added to this conversation by Admin`,
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return successResponse({
      success: true
    }, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error(
      "ADMIN_COMPLAINTS",
      "Error adding provider to complaint",
      error,
      { complaintId: id },
    );
    return NextResponse.json({
      success: false,
      error: "Internal Error"
    }, {
      status: 500
    });
  }
}
