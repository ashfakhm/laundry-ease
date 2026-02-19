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
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { DELIVERY_OTP_TTL_MS } from "@/lib/constants";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

// POST: Update Order Process Status
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:status:update",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireProvider();

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid order id", 400);
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return legacyErrorResponse("Order not found", 404);
    }

    if (order.provider_id.toString() !== user.id) {
      return legacyErrorResponse("Unauthorized", 403);
    }

    // Work progression is blocked until payment is completed.
    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "held" &&
      order.payment_status !== "released"
    ) {
      return legacyErrorResponse(
        "Order must be paid before updating workflow status",
        400,
      );
    }

    const body = await req.json();
    const parsed = orderStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return legacyErrorResponse("Invalid status data", 400, {
        fields: parsed.error.flatten().fieldErrors,
      });
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
      return legacyErrorResponse(
        `Cannot transition from "${currentStatus}" to "${status}". Allowed next states: ${allowedNextStates.join(
          ", "
        )}`,
        422,
        {
          currentStatus,
          allowedNextStates,
        },
      );
    }

    const { db } = await getDb();

    // Logic for Penalty Calculation when marking 'delivered' (or 'ready' if that stops the clock)
    // PRD: "If delivery exceeds the deadline... penalty... applied"
    // Usually penalty is finalized at 'delivered' or 'out_for_delivery'?
    // Let's calculate it when status becomes "delivered".

    // OTP Logic
    const updateData: {
      process_status: OrderProcessStatus;
      updatedAt: Date;
      delivery_otp?: string;
      delivery_otp_sent_at?: Date;
      delivery_otp_expires_at?: Date;
      delivery_otp_resend_count?: number;
    } = {
      process_status: status as OrderProcessStatus,
      updatedAt: new Date(),
    };

    if (status === "out_for_delivery") {
      // Generate OTP for delivery confirmation
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpSentAt = new Date();
      const otpExpiresAt = new Date(otpSentAt.getTime() + DELIVERY_OTP_TTL_MS);
      updateData.delivery_otp = otp;
      updateData.delivery_otp_sent_at = otpSentAt;
      updateData.delivery_otp_expires_at = otpExpiresAt;
      updateData.delivery_otp_resend_count = 0;
      // Send OTP to seeker via email (Gmail)
      const seeker = await db
        .collection("seekers")
        .findOne({ _id: order.seeker_id });
      if (seeker?.email) {
        try {
          await enqueueEmailOutboxJob({
            kind: "delivery_otp",
            payload: {
              to: String(seeker.email),
              otp,
              orderId: id,
              ttlMinutes: Math.floor(DELIVERY_OTP_TTL_MS / 60_000),
            },
          });
          logger.info("ORDERS", "Delivery OTP email queued", {
            orderId: id,
          });
        } catch (err) {
          logger.error("ORDERS", "Failed to queue delivery OTP email", err, {
            orderId: id,
          });
        }
      } else {
        logger.warn("ORDERS", "Seeker email not found, cannot send OTP email", {
          orderId: id,
        });
      }
    }

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

    return legacySuccessResponse({
      message: "Status updated successfully",
      currentStatus: status,
      allowedNextStates: getAllowedNextStates(status as OrderProcessStatus),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ORDERS", "Error updating order status", error, {
      orderId: id,
    });
    return legacyErrorResponse("Internal server error", 500);
  }
}
