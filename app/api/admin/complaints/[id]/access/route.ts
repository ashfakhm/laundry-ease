import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { adminComplaintAccessSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid complaint id"));
    }

    const session = await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminComplaintAccessSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid access data"));
    }

    const { granted } = parsed.data;
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint)
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Complaint not found"));

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Cannot update provider access after complaint is finalized"));
    }

    if (granted && complaint.status !== "accepted" && complaint.status !== "in_review") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Complaint must be accepted before granting provider access"));
    }

    if (!ObjectId.isValid(String(complaint.provider_id))) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Complaint provider reference is invalid"));
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

    return successResponse({ granted });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ADMIN_COMPLAINTS", "Error updating access", error, {
      complaintId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
