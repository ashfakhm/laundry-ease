import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { bookingChatMessageSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";
import realtimeContracts from "@/lib/realtime/contracts";
import { emitOrderMessageCreated } from "@/lib/realtime/emitter";

/**
 * GET /api/orders/[id]/chat
 * Returns all chat messages for an order (seeker or provider must be participant)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"),
      );
    }

    await enforceRateLimit(req, {
      bucket: "orders:chat:get",
      max: 120,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const orderId = new ObjectId(id);
    const { db } = await getDb();
    const order = await db.collection("orders").findOne({ _id: orderId });
    if (!order) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"),
      );
    }

    // Only allow seeker, provider, or admin
    const isSeeker = user.id === order.seeker_id?.toString();
    const isProvider = user.id === order.provider_id?.toString();
    const isAdmin = user.role === "admin";
    if (!isSeeker && !isProvider && !isAdmin) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Forbidden"));
    }

    const messages = await db
      .collection("order_chats")
      .find({
        order_id: orderId,
        deletedFor: { $ne: user.id },
      })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    return successResponse(
      messages.map((message) =>
        realtimeContracts.serializeOrderChatMessage(
          message as Record<string, unknown>,
        ),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Fetch order chat failed", error, {
      orderId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal error"),
    );
  }
}

/**
 * POST /api/orders/[id]/chat
 * Body: { message }
 * Adds a chat message to an order (seeker or provider only)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:chat:post",
      max: 40,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"),
      );
    }

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const body = await req.json();
    const parsed = bookingChatMessageSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid chat message",
          parsed,
        ),
      );
    }

    const orderId = new ObjectId(id);
    const { db } = await getDb();

    const order = await db.collection("orders").findOne({ _id: orderId });
    if (!order) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"),
      );
    }

    // Determine sender role — only seeker or provider can send
    let senderRole: "seeker" | "provider" | null = null;
    if (user.id === order.seeker_id?.toString()) senderRole = "seeker";
    if (user.id === order.provider_id?.toString()) senderRole = "provider";
    if (!senderRole) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Forbidden"));
    }

    const voiceMessage = parsed.data.voiceMessage ?? "";
    const voiceDurationMs = voiceMessage
      ? parsed.data.voiceDurationMs ?? 0
      : 0;

    const chatMsg = {
      order_id: orderId,
      sender_id: user.id,
      sender_role: senderRole,
      message: (parsed.data.message ?? "").trim(),
      attachments: parsed.data.attachments ?? [],
      voiceMessage,
      voiceDurationMs,
      createdAt: new Date(),
    };
    const insertResult = await db.collection("order_chats").insertOne(chatMsg);
    const persistedMessage = {
      _id: insertResult.insertedId,
      ...chatMsg,
    };

    emitOrderMessageCreated(persistedMessage as Record<string, unknown>);

    return successResponse(
      realtimeContracts.serializeOrderChatMessage(
        persistedMessage as Record<string, unknown>,
      ),
      200,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Send order chat failed", error, {
      orderId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal error"),
    );
  }
}
