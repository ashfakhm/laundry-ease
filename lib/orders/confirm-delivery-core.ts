/**
 * Shared delivery-confirmation core logic used by both:
 *   - POST /api/orders/[id]/otp/verify       (provider verifies OTP)
 *   - POST /api/orders/[id]/confirm-delivery  (seeker confirms delivery)
 */

import { ObjectId, type Db, type ClientSession } from "mongodb";
import type { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { evaluateDeadlineCompensation } from "@/lib/orders/deadline-compensation";
import { buildConfirmDeliveryUpdateFields } from "@/lib/db/orders";
import { DELIVERY_OTP_TTL_MS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryConfirmationInput {
  orderId: string;
  /** The already-fetched order document (fields actually accessed by this function) */
  order: Pick<
    Order,
    | "delivery_otp"
    | "delivery_otp_expires_at"
    | "delivery_otp_sent_at"
    | "payment_status"
    | "deadline_compensated_at"
    | "razorpay_refund_id"
    | "total_price"
    | "deadline"
    | "razorpay_payment_id"
  >;
  otp: string;
  actorRole: "seeker" | "provider";
  actorId: string;
}

export interface DeliveryConfirmationResult {
  message: string;
  deadlineCompensationApplied?: boolean;
  deadlineBreached?: boolean;
}

// ---------------------------------------------------------------------------
// OTP verification helpers
// ---------------------------------------------------------------------------

/** Throws AppError if OTP is expired based on expiry or sent-at timestamp */
export function assertOtpNotExpired(
  otpExpiresAt: Date | string | undefined,
  otpSentAt: Date | string | undefined,
  nowMs: number,
): void {
  if (otpExpiresAt) {
    const expiryDate = new Date(otpExpiresAt);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() <= nowMs) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        410,
        "OTP expired. Please resend OTP.",
      );
    }
  } else if (otpSentAt) {
    const sentDate = new Date(otpSentAt);
    if (
      !Number.isNaN(sentDate.getTime()) &&
      sentDate.getTime() + DELIVERY_OTP_TTL_MS <= nowMs
    ) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        410,
        "OTP expired. Please resend OTP.",
      );
    }
  }
}

/** Verifies OTP against the hashed value via bcrypt. Throws on mismatch. */
export async function verifyOtpHash(
  plainOtp: string,
  hashedOtp: string | undefined,
): Promise<void> {
  if (!hashedOtp) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid OTP");
  }
  const bcrypt = await import("bcrypt");
  const isValid = await bcrypt.compare(plainOtp, hashedOtp);
  if (!isValid) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid OTP");
  }
}

// ---------------------------------------------------------------------------
// Core delivery confirmation (OTP verify → deadline comp → transaction)
// ---------------------------------------------------------------------------

/**
 * Performs OTP verification, deadline compensation evaluation, and transactional
 * order update. Called inside a MongoDB session from the route handler.
 *
 * Returns a result the route can use to build its response.
 */
export async function executeDeliveryConfirmation(
  db: Db,
  session: ClientSession,
  input: DeliveryConfirmationInput,
): Promise<DeliveryConfirmationResult> {
  const { orderId, order, otp, actorRole, actorId } = input;
  const order_id = new ObjectId(orderId);

  // 1. OTP expiry check
  assertOtpNotExpired(
    order.delivery_otp_expires_at,
    order.delivery_otp_sent_at,
    Date.now(),
  );

  // 2. OTP hash verification
  await verifyOtpHash(otp, order.delivery_otp);

  // 3. Deadline compensation evaluation
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
    throw new AppError(
      ErrorCode.CONFLICT,
      409,
      compensationDecision.blockedMessage ||
        "Deadline compensation cannot be applied automatically.",
    );
  }

  // 4. Conditional refund for deadline breach
  if (shouldRefund) {
    if (!order.razorpay_payment_id) {
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        "Deadline missed, but payment reference is unavailable for automatic refund. Please contact support.",
      );
    }

    try {
      const refund = await refundRazorpayPayment(
        order.razorpay_payment_id,
        Math.round(paidAmount * 100),
        { reason: "deadline_breach_full_refund", order_id: orderId },
      );
      refundId = refund.id || null;
    } catch (error) {
      logger.error("ORDERS", "Failed to refund late-delivery order", error, {
        orderId,
        actorRole,
      });
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        502,
        "Deadline was missed, but refund could not be processed right now. Please retry.",
      );
    }
  }

  // 5. Re-fetch order inside session + build update fields
  const orderCheck = await db
    .collection("orders")
    .findOne({ _id: order_id }, { session });
  if (!orderCheck) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      500,
      "Failed to confirm delivery",
    );
  }

  const setFields = buildConfirmDeliveryUpdateFields(orderCheck, now);

  if (deadlineBreached && !alreadyCompensated) {
    Object.assign(setFields, {
      deadline_breached_at: now,
      deadline_compensated_at: new Date(),
      deadline_compensation_mode: shouldRefund ? "full_refund" : "no_charge",
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

  // 6. Atomic update
  const res = await db
    .collection("orders")
    .updateOne({ _id: order_id }, { $set: setFields }, { session });

  if (res.modifiedCount === 0) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      500,
      "Failed to confirm delivery",
    );
  }

  // 7. Build result
  if (deadlineBreached && !alreadyCompensated) {
    logger.info("ORDERS", "Deadline compensation applied on delivery", {
      orderId,
      actorId,
      actorRole,
      refundId,
    });

    return {
      message: shouldRefund
        ? "Delivery confirmed. Deadline was missed and a full refund has been issued."
        : "Delivery confirmed. Deadline was missed and marked for no-charge completion.",
      deadlineCompensationApplied: shouldRefund,
      deadlineBreached: true,
    };
  }

  logger.info("ORDERS", "Delivery confirmed", {
    orderId,
    actorId,
    actorRole,
  });

  return { message: "Delivery confirmed" };
}
