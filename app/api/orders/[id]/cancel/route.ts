import { NextResponse } from "next/server";
import { getOrderById, cancelOrder } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";

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
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"));
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if (order.seeker_id.toString() !== user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "You are not authorized to cancel this order"));
    }

    if (order.payment_status !== "unpaid") {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Cannot cancel an order that has been paid"));
    }

    if (order.cancellation_status) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Order has already been cancelled"));
    }

    const success = await cancelOrder(
      order_id,
      new ObjectId(user.id),
      CANCELLATION_FEE
    );

    if (success) {
      return successResponse({ message: "Order cancelled successfully" });
    } else {
      return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to cancel order"));
    }
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

    logger.error("ORDERS", "Error cancelling order", error, { orderId: id });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
