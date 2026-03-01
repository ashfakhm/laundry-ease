import { successResponse, errorResponse } from "@/lib/api/response";
import { getOrderById } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { executeDeliveryConfirmation } from "@/lib/orders/confirm-delivery-core";

const schema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

// POST: Provider verifies delivery OTP and marks delivery confirmed
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:otp-verify",
      max: 20,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireProvider();

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"));
    }

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid OTP"));
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if (order.provider_id.toString() !== user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
    }

    if ((order.process_status || "invoiced") === "delivered") {
      return successResponse({ message: "Delivery already confirmed",
          idempotent: true,
          deadlineCompensationApplied:
            order.payment_status === "refunded" ||
            Boolean(order.deadline_compensated_at) });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "OTP can only be verified when order is out for delivery"));
    }

    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "held" &&
      order.payment_status !== "released"
    ) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Order must be paid before confirming delivery"));
    }

    const { db, client } = await getDb();
    const session = client.startSession();

    try {
      return await session.withTransaction(async () => {
        const result = await executeDeliveryConfirmation(db, session, {
          orderId: id,
          order,
          otp: parsed.data.otp,
          actorRole: "provider",
          actorId: user.id,
        });
        return successResponse(result);
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Error verifying delivery OTP", error, {
      orderId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
