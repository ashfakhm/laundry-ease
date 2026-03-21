import { getOrderById } from "@/lib/db/orders";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { confirmDeliverySchema } from "@/lib/api/schemas";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api/response";
import { executeDeliveryConfirmation } from "@/lib/orders/confirm-delivery-core";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:confirm-delivery",
      max: 15,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"));
    }

    const body = await req.json();
    const parsed = confirmDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid OTP data"));
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if (order.seeker_id.toString() !== user.id) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if ((order.process_status || "invoiced") === "delivered") {
      return successResponse({ message: "Delivery already confirmed",
        idempotent: true,
        deadlineCompensationApplied:
          order.payment_status === "refunded" ||
          Boolean(order.deadline_compensated_at) });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Delivery can only be confirmed when order is out for delivery"));
    }

    if (
      !(["paid", "held", "released", "refunded"] as readonly string[]).includes(
        order.payment_status,
      )
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
          actorRole: "seeker",
          actorId: user.id,
        });
        revalidatePath(`/seeker/orders/${id}`);
        return successResponse(result);
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Error confirming delivery", error, { orderId: id });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
