import { getOrderById, cancelOrder } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

const CANCELLATION_FEE = 1000; // 10 currency units

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:cancel",
      max: 12,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid order id", 400);
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return legacyErrorResponse("Order not found", 404);
    }

    if (order.seeker_id.toString() !== user.id) {
      return legacyErrorResponse(
        "You are not authorized to cancel this order",
        403,
      );
    }

    if (order.payment_status !== "unpaid") {
      return legacyErrorResponse("Cannot cancel an order that has been paid", 400);
    }

    if (order.cancellation_status) {
      return legacyErrorResponse("Order has already been cancelled", 400);
    }

    const success = await cancelOrder(
      order_id,
      new ObjectId(user.id),
      CANCELLATION_FEE
    );

    if (success) {
      return legacySuccessResponse({ message: "Order cancelled successfully" });
    } else {
      return legacyErrorResponse("Failed to cancel order", 500);
    }
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ORDERS", "Error cancelling order", error, { orderId: id });
    return legacyErrorResponse("Internal server error", 500);
  }
}
