import { getOrderById, confirmDelivery } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { evaluateDeadlineCompensation } from "@/lib/orders/deadline-compensation";
import { requireProvider } from "@/lib/api/auth";
import { DELIVERY_OTP_TTL_MS } from "@/lib/constants";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacyMessageResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

const schema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

// POST: Provider verifies delivery OTP and marks delivery confirmed
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:otp-verify",
      max: 20,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireProvider();

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid order id", 400);
    }

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return legacyErrorResponse("Invalid OTP", 400, {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return legacyErrorResponse("Order not found", 404);
    }

    if (order.provider_id.toString() !== user.id) {
      return legacyErrorResponse("Unauthorized", 403);
    }

    if ((order.process_status || "invoiced") === "delivered") {
      return legacySuccessResponse({
        message: "Delivery already confirmed",
        idempotent: true,
        deadlineCompensationApplied:
          order.payment_status === "refunded" ||
          Boolean(order.deadline_compensated_at),
      });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return legacyMessageResponse(
        "OTP can only be verified when order is out for delivery",
        409,
        {
          currentStatus: order.process_status || "invoiced",
        },
      );
    }

    // Allow verification even if payment is already in escrow states.
    // "paid" = captured, "held" = escrow started (delivery confirmed),
    // "released" = escrow released. "refunded" and "unpaid" should not allow.
    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "held" &&
      order.payment_status !== "released"
    ) {
      return legacyErrorResponse("Order must be paid before confirming delivery", 400);
    }

    const { otp } = parsed.data;

    const nowMs = Date.now();
    const otpExpiresAt = order.delivery_otp_expires_at;
    const otpSentAt = order.delivery_otp_sent_at;

    if (otpExpiresAt) {
      const expiryDate = new Date(otpExpiresAt);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() <= nowMs) {
        return legacyErrorResponse("OTP expired. Please resend OTP.", 410);
      }
    } else if (otpSentAt) {
      const sentDate = new Date(otpSentAt);
      if (
        !Number.isNaN(sentDate.getTime()) &&
        sentDate.getTime() + DELIVERY_OTP_TTL_MS <= nowMs
      ) {
        return legacyErrorResponse("OTP expired. Please resend OTP.", 410);
      }
    }

    // Verify OTP exactly as stored on the order
    if (!order.delivery_otp || order.delivery_otp !== otp) {
      return legacyErrorResponse("Invalid OTP", 400);
    }

    const now = new Date();
    const orderDeadline = order.deadline ? new Date(order.deadline) : null;

    const alreadyCompensated =
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
      return legacyErrorResponse(
        compensationDecision.blockedMessage ||
          "Deadline compensation cannot be applied automatically.",
        409,
      );
    }

    if (shouldRefund) {
      if (!order.razorpay_payment_id) {
        return legacyErrorResponse(
          "Deadline missed, but payment reference is unavailable for automatic refund. Please contact support.",
          409,
        );
      }

      try {
        const refund = await refundRazorpayPayment(
          order.razorpay_payment_id,
          Math.round(paidAmount * 100),
          {
            reason: "deadline_breach_full_refund",
            order_id: id,
          }
        );
        refundId = refund.id || null;
      } catch (error) {
        logger.error(
          "ORDERS",
          "Failed to refund late-delivery order before OTP verification completion",
          error,
          { orderId: id }
        );
        return legacyErrorResponse(
          "Deadline was missed, but refund could not be processed right now. Please retry.",
          502,
        );
      }
    }

    const success = await confirmDelivery(order_id);
    if (!success) {
      return legacyErrorResponse("Failed to confirm delivery", 500);
    }

    if (deadlineBreached && !alreadyCompensated) {
      const { db } = await getDb();
      await db.collection("orders").updateOne(
        { _id: order_id },
        {
          $set: {
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
              ? {
                  payment_status: "refunded",
                  latePenalty: paidAmount,
                }
              : {}),
            updatedAt: new Date(),
          },
        }
      );

      logger.info("ORDERS", "Deadline compensation applied on delivery OTP", {
        orderId: id,
        providerId: user.id,
        refundId,
      });

      return legacySuccessResponse({
        message: shouldRefund
          ? "Delivery confirmed. Deadline was missed and a full refund has been issued."
          : "Delivery confirmed. Deadline was missed and marked for no-charge completion.",
        deadlineCompensationApplied: shouldRefund,
        deadlineBreached: true,
      });
    }

    logger.info("ORDERS", "Delivery OTP verified by provider", {
      orderId: id,
      providerId: user.id,
    });

    return legacySuccessResponse({
      message: "Delivery confirmed",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ORDERS", "Error verifying delivery OTP", error, {
      orderId: id,
    });
    return legacyErrorResponse("Internal server error", 500);
  }
}
