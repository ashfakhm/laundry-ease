import { NextResponse } from "next/server";
import { getOrderById, cancelOrder } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";

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
      return NextResponse.json({
        success: false,
        error: "Invalid order id"
      }, {
        status: 400
      });
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({
        success: false,
        error: "Order not found"
      }, {
        status: 404
      });
    }

    if (order.seeker_id.toString() !== user.id) {
      return NextResponse.json({
        success: false,
        error: "You are not authorized to cancel this order"
      }, {
        status: 403
      });
    }

    if (order.payment_status !== "unpaid") {
      return NextResponse.json({
        success: false,
        error: "Cannot cancel an order that has been paid"
      }, {
        status: 400
      });
    }

    if (order.cancellation_status) {
      return NextResponse.json({
        success: false,
        error: "Order has already been cancelled"
      }, {
        status: 400
      });
    }

    const success = await cancelOrder(
      order_id,
      new ObjectId(user.id),
      CANCELLATION_FEE
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Order cancelled successfully"
      }, {
        status: 200
      });
    } else {
      return NextResponse.json({
        success: false,
        error: "Failed to cancel order"
      }, {
        status: 500
      });
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
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
