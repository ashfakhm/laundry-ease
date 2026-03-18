import { successResponse, errorResponse } from "@/lib/api/response";
import { revalidatePath } from "next/cache";
import { getOrderById } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { orderStatusUpdateSchema } from "@/lib/api/schemas";
import { requireProvider } from "@/lib/api/auth";
import {
  getAllowedNextStates,
  type OrderProcessStatus,
} from "@/lib/orders/status-machine";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";

// POST: Update Order Process Status
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:status:update",
      max: 30,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireProvider();

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"));
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if (order.provider_id.toString() !== user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
    }

    // Work progression is blocked until payment is completed.
    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "held" &&
      order.payment_status !== "released"
    ) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Order must be paid before updating workflow status"));
    }

    const body = await req.json();
    const parsed = orderStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid status data"));
    }

    const { status } = parsed.data;

    const currentStatus = (order.process_status ||
      "invoiced") as OrderProcessStatus;
    const allowedNextStates = getAllowedNextStates(currentStatus);

    if (!allowedNextStates.includes(status as OrderProcessStatus)) {
      logger.warn("ORDERS", "Invalid state transition attempted", {
        orderId: id,
        currentStatus,
        attemptedStatus: status,
        allowedNextStates,
      });
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 422, `Cannot transition from "${currentStatus}" to "${status}". Allowed next states: ${allowedNextStates.join(", ")}`));
    }

    const { db } = await getDb();

    // Logic for Penalty Calculation when marking 'delivered' (or 'ready' if that stops the clock)
    // PRD: "If delivery exceeds the deadline... penalty... applied"
    // Usually penalty is finalized at 'delivered' or 'out_for_delivery'?
    // Let's calculate it when status becomes "delivered".

    // OTP Logic
    const updateData = {
      process_status: status as OrderProcessStatus,
      updatedAt: new Date(),
    };

    // CRITICAL: "delivered" status can ONLY be set through confirm-delivery endpoint
    // This endpoint handles workflow status (processing → washing → ironing → ready → out_for_delivery)
    // Delivery confirmation requires OTP and must go through /api/orders/[id]/confirm-delivery
    // Schema validation ensures "delivered" cannot be sent here

    // Late penalty calculation happens in confirm-delivery endpoint, not here
    // This endpoint only handles workflow status transitions (processing → washing → ironing → ready → out_for_delivery)

    await db
      .collection("orders")
      .updateOne({ _id: order_id }, { $set: updateData });

    revalidatePath(`/seeker/orders/${id}`);

    return successResponse({ message: "Status updated successfully",
        currentStatus: status,
        allowedNextStates: getAllowedNextStates(status as OrderProcessStatus) });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Error updating order status", error, {
      orderId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
