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
import { requireAuth } from "@/lib/api/auth";
import { emitOrderMessageDeleted } from "@/lib/realtime/emitter";

/**
 * DELETE /api/orders/[id]/chat/[messageId]
 *
 * Query: ?mode=for_me | for_everyone
 *
 * - for_me: Adds current user to `deletedFor[]` — hides message from own view only
 * - for_everyone: Sender-only, within 1hr window — soft-deletes message for all participants
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:chat:delete",
      max: 30,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id) || !ObjectId.isValid(messageId)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid ID"),
      );
    }

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const requestUrl = new URL(req.url);
    const mode = requestUrl.searchParams.get("mode");
    if (mode !== "for_me" && mode !== "for_everyone") {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "mode must be for_me or for_everyone",
        ),
      );
    }

    const orderId = new ObjectId(id);
    const msgId = new ObjectId(messageId);
    const { db } = await getDb();

    // Verify order exists and user is a participant
    const order = await db.collection("orders").findOne({ _id: orderId });
    if (!order) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"),
      );
    }

    const isSeeker = user.id === order.seeker_id?.toString();
    const isProvider = user.id === order.provider_id?.toString();
    if (!isSeeker && !isProvider) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Forbidden"));
    }

    // Fetch the message
    const message = await db.collection("order_chats").findOne({
      _id: msgId,
      order_id: orderId,
    });
    if (!message) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Message not found"),
      );
    }

    if (mode === "for_me") {
      // Add user to deletedFor array (idempotent)
      await db
        .collection("order_chats")
        .updateOne({ _id: msgId }, { $addToSet: { deletedFor: user.id } });
      return successResponse({ deleted: true, mode: "for_me" });
    }

    // mode === "for_everyone"
    // Only the original sender can delete for everyone
    if (
      message.sender_id !== user.id &&
      message.sender_id?.toString() !== user.id
    ) {
      return errorResponse(
        new AppError(
          ErrorCode.FORBIDDEN,
          403,
          "Only the sender can delete for everyone",
        ),
      );
    }

    // Check time window
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

    // Soft-delete: set flag and clear content
    await db.collection("order_chats").updateOne(
      { _id: msgId },
      {
        $set: {
          deletedForEveryone: true,
          message: "",
          attachments: [],
          voiceMessage: "",
          voiceDurationMs: 0,
        },
      },
    );

    emitOrderMessageDeleted(id, messageId, "for_everyone");

    return successResponse({ deleted: true, mode: "for_everyone" });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Delete order chat message failed", error, {
      orderId: id,
      messageId,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal error"),
    );
  }
}
