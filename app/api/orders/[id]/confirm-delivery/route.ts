import {
  getOrderById,
  buildConfirmDeliveryUpdateFields,
} from "@/lib/db/orders";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { confirmDeliverySchema } from "@/lib/api/schemas";
import { revalidatePath } from "next/cache";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { evaluateDeadlineCompensation } from "@/lib/orders/deadline-compensation";
import { requireSeeker } from "@/lib/api/auth";
import { DELIVERY_OTP_TTL_MS, RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api/response";

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

    const { otp } = parsed.data;

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if (order.seeker_id.toString() !== user.id) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "You are not authorized to confirm delivery for this order"));
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

    // If escrow has already started, payment_status will be "held" (or later "released").
    // Confirming delivery should still be allowed in these post-payment states so the UI can reach "Delivered".
    if (
      !(["paid", "held", "released", "refunded"] as readonly string[]).includes(
        order.payment_status,
      )
    ) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Order must be paid before confirming delivery"));
    }

    const nowMs = Date.now();
    const otpExpiresAt = order.delivery_otp_expires_at;
    const otpSentAt = order.delivery_otp_sent_at;

    if (otpExpiresAt) {
      const expiryDate = new Date(otpExpiresAt);
      if (
        !Number.isNaN(expiryDate.getTime()) &&
        expiryDate.getTime() <= nowMs
      ) {
        return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 410, "OTP expired. Please resend OTP."));
      }
    } else if (otpSentAt) {
      const sentDate = new Date(otpSentAt);
      if (
        !Number.isNaN(sentDate.getTime()) &&
        sentDate.getTime() + DELIVERY_OTP_TTL_MS <= nowMs
      ) {
        return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 410, "OTP expired. Please resend OTP."));
      }
    }

    // Verify OTP using bcrypt (timing-safe and secure)
    if (!order.delivery_otp) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid OTP"));
    }
    const bcrypt = await import("bcrypt");
    const isOtpValid = await bcrypt.compare(otp, order.delivery_otp);
    if (!isOtpValid) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid OTP"));
    }

    const now = new Date();
    const orderDeadline = order.deadline ? new Date(order.deadline) : null;

    const alreadyCompensated =
      order.payment_status === "refunded" ||
      Boolean(order.deadline_compensated_at) ||
      Boolean(order.razorpay_refund_id);

    const paidAmount = Number(order.total_price || 0);
    let refundId: string | null = null;
    const compensationDecision = evaluateDeadlineCompensation({
      now,
      deadline: orderDeadline,
      paymentStatus: order.payment_status,
      alreadyCompensated,
      paidAmount,
    });
    const { deadlineBreached, shouldRefund } = compensationDecision;

    if (compensationDecision.blocked) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, compensationDecision.blockedMessage ||
          "Deadline compensation cannot be applied automatically."));
    }

    const { db, client } = await getDb();
    const session = client.startSession();

    try {
      return await session.withTransaction(async () => {
        if (shouldRefund) {
          if (!order.razorpay_payment_id) {
            return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Deadline missed, but payment reference is unavailable for automatic refund. Please contact support."));
          }

          try {
            const refund = await refundRazorpayPayment(
              order.razorpay_payment_id,
              Math.round(paidAmount * 100),
              {
                reason: "deadline_breach_full_refund",
                order_id: id,
              },
            );
            refundId = refund.id || null;
          } catch (error) {
            logger.error(
              "ORDERS",
              "Failed to refund late-delivery order before confirmation",
              error,
              { orderId: id },
            );
            return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 502, "Deadline was missed, but refund could not be processed right now. Please retry."));
          }
        }

        // We shouldn't use `confirmDelivery` here directly since it opens its own transaction
        // However, nested transactions are not supported.
        // We will inline the `confirmDelivery` functionality here.
        const orderCheck = await db
          .collection("orders")
          .findOne({ _id: order_id }, { session });
        if (!orderCheck) {
          return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to confirm delivery"));
        }

        const setFields = buildConfirmDeliveryUpdateFields(orderCheck, now);

        if (deadlineBreached && !alreadyCompensated) {
          Object.assign(setFields, {
            deadline_breached_at: now,
            deadline_compensated_at: new Date(),
            deadline_compensation_mode: shouldRefund
              ? "full_refund"
              : "no_charge",
            refund_amount: shouldRefund ? paidAmount : 0,
            refund_reason: shouldRefund
              ? "Delivery confirmed after seeker deadline"
              : "Delivery confirmed after seeker deadline (no captured amount)",
            ...(refundId ? { razorpay_refund_id: refundId } : {}),
            ...(shouldRefund
              ? { payment_status: "refunded", latePenalty: paidAmount }
              : {}),
            updatedAt: new Date(),
          });
        }

        const res = await db
          .collection("orders")
          .updateOne({ _id: order_id }, { $set: setFields }, { session });

        const success = res.modifiedCount > 0;

        if (success) {
          revalidatePath(`/seeker/orders/${id}`);
          if (deadlineBreached && !alreadyCompensated) {
            return successResponse({ message: shouldRefund
                ? "Delivery confirmed. Deadline was missed and a full refund has been issued."
                : "Delivery confirmed. Deadline was missed and marked for no-charge completion.",

              deadlineCompensationApplied: shouldRefund,
              deadlineBreached: true });
          }

          return successResponse({ message: "Delivery confirmed, escrow started" });
        } else {
          return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to confirm delivery"));
        }
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
