import { successResponse, errorResponse } from "@/lib/api/response";
import {
  RATE_LIMIT_DEFAULT_WINDOW_MS,
  DELETE_FOR_EVERYONE_WINDOW_MS,
} from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { canAccessComplaintConversation } from "@/lib/complaints/access";
import { requireAuth } from "@/lib/api/auth";
import { emitComplaintMessageDeleted } from "@/lib/realtime/emitter";

type ComplaintAccessDoc = {
  seeker_id: ObjectId;
  provider_id: ObjectId;
  provider_access_granted?: boolean;
  status: string;
};

/**
 * DELETE /api/complaints/[id]/messages/[messageId]
 *
 * Query: ?mode=for_me | for_everyone | admin_hard_delete
 *
 * - for_me: Hides message from own view (any participant)
 * - for_everyone: Sender soft-delete within 1hr window (shows "deleted" placeholder)
 *   OR admin soft-delete (no time window, shows "deleted" placeholder to users)
 * - admin_hard_delete: Admin-only — permanently removes message, no trace left
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "complaints:messages:delete",
      max: 30,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id) || !ObjectId.isValid(messageId)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid ID"),
      );
    }

    const { user } = await requireAuth();
    if (!user?.id || !ObjectId.isValid(user.id) || !user.role) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const requestUrl = new URL(req.url);
    const mode = requestUrl.searchParams.get("mode");
    if (
      mode !== "for_me" &&
      mode !== "for_everyone" &&
      mode !== "admin_hard_delete"
    ) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "mode must be for_me, for_everyone, or admin_hard_delete",
        ),
      );
    }

    const actorId = new ObjectId(user.id);
    const complaintId = new ObjectId(id);
    const msgId = new ObjectId(messageId);
    const { db } = await getDb();

    // Verify complaint exists and user has access
    const complaint = await db
      .collection<ComplaintAccessDoc>("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Complaint not found"),
      );
    }

    const access = canAccessComplaintConversation({
      actorId: actorId.toString(),
      actorRole: user.role,
      complaint: {
        seekerId: complaint.seeker_id.toString(),
        providerId: complaint.provider_id.toString(),
        providerAccessGranted: complaint.provider_access_granted,
        status: complaint.status,
      },
    });
    if (!access.allowed) {
      return errorResponse(
        new AppError(ErrorCode.FORBIDDEN, 403, access.error),
      );
    }

    // Fetch the message
    const message = await db.collection("complaint_messages").findOne({
      _id: msgId,
      complaint_id: complaintId,
    });
    if (!message) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Message not found"),
      );
    }

    // Cannot delete SYSTEM messages
    if (message.message_type === "SYSTEM") {
      return errorResponse(
        new AppError(
          ErrorCode.FORBIDDEN,
          403,
          "System messages cannot be deleted",
        ),
      );
    }

    // ── admin_hard_delete: Admin-only, permanent removal ──
    if (mode === "admin_hard_delete") {
      if (user.role !== "admin") {
        return errorResponse(
          new AppError(
            ErrorCode.FORBIDDEN,
            403,
            "Only admins can hard-delete messages",
          ),
        );
      }

      await db.collection("complaint_messages").deleteOne({ _id: msgId });
      emitComplaintMessageDeleted(id, messageId, "hard_delete");

      return successResponse({ deleted: true, mode: "admin_hard_delete" });
    }

    // ── for_me: Hide from own view ──
    if (mode === "for_me") {
      await db
        .collection("complaint_messages")
        .updateOne({ _id: msgId }, { $addToSet: { deletedFor: user.id } });
      return successResponse({ deleted: true, mode: "for_me" });
    }

    // ── for_everyone: Soft-delete for all ──
    const isAdmin = user.role === "admin";
    const isSender =
      message.sender_id === user.id ||
      message.sender_id?.toString() === user.id;

    // Admin can delete for everyone (any message, no time window)
    // Regular users can only delete their own messages within the time window
    if (!isAdmin && !isSender) {
      return errorResponse(
        new AppError(
          ErrorCode.FORBIDDEN,
          403,
          "Only the sender can delete for everyone",
        ),
      );
    }

    if (!isAdmin) {
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      if (messageAge > DELETE_FOR_EVERYONE_WINDOW_MS) {
        return errorResponse(
          new AppError(
            ErrorCode.FORBIDDEN,
            403,
            "Delete for everyone window has expired",
          ),
        );
      }
    }

    await db.collection("complaint_messages").updateOne(
      { _id: msgId },
      {
        $set: {
          deletedForEveryone: true,
          content: "",
          attachments: [],
          voiceMessage: "",
        },
      },
    );

    emitComplaintMessageDeleted(id, messageId, "for_everyone");

    return successResponse({ deleted: true, mode: "for_everyone" });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("COMPLAINTS", "Delete complaint message failed", error, {
      complaintId: id,
      messageId,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal error"),
    );
  }
}
