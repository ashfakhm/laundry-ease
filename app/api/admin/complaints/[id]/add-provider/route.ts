import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const session = await requireAdminWithDbCheck();

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid complaint ID"));
    }

    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Not Found"));
    }

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Cannot add provider after complaint is finalized"));
    }

    if (complaint.status !== "accepted" && complaint.status !== "in_review") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Complaint must be accepted before adding provider"));
    }

    // Check if provider already has access
    if (complaint.provider_access_granted) {
      return successResponse({ idempotent: true,
        message: "Provider already added" });
    }

    if (!ObjectId.isValid(String(complaint.provider_id))) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Complaint provider reference is invalid"));
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
      return errorResponse(error);
    }

    logger.error(
      "ADMIN_COMPLAINTS",
      "Error adding provider to complaint",
      error,
      { complaintId: id },
    );
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Error"));
  }
}
