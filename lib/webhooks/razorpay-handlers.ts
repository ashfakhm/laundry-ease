/**
 * Razorpay webhook event handlers.
 *
 * Each handler runs inside a MongoDB session/transaction.
 * Extracted from the webhook route to keep the route file thin and
 * make individual handlers independently testable.
 */

import { ClientSession, Db } from "mongodb";
import { logger } from "@/lib/logger";
import { telemetry } from "@/lib/telemetry";
import { MONEY_EPSILON, round2 } from "@/lib/utils/monetary";

// ─── payment.authorized / payment.captured ───────────────────────────

export async function handlePaymentCaptured(
  event: { id: string; payload: { payment: { entity: Record<string, unknown> } } },
  db: Db,
  session: ClientSession,
): Promise<void> {
  const payment = event.payload.payment.entity;
  const paidAt = payment.captured_at
    ? new Date((payment.captured_at as number) * 1000)
    : new Date();

  await db.collection("payments").updateOne(
    { razorpay_payment_id: payment.id },
    {
      $set: {
        status: payment.status,
        amount: (payment.amount as number) / 100,
        currency: payment.currency,
        method: payment.method,
        event_id: event.id,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        razorpay_order_id: payment.order_id,
        createdAt: new Date(),
      },
    },
    { upsert: true, session },
  );

  telemetry.increment("payment.captured", 1, [
    `amount:${(payment.amount as number) / 100}`,
    `currency:${payment.currency}`,
  ]);

  logger.info("WEBHOOK", "Payment status updated", {
    paymentId: payment.id,
    status: payment.status,
  });

  const orderUpdate = await db.collection("orders").updateOne(
    {
      razorpay_order_id: payment.order_id,
      payment_status: "unpaid",
    },
    {
      $set: {
        payment_status: "paid",
        razorpay_payment_id: payment.id,
        payment_made_at: paidAt,
        updatedAt: new Date(),
      },
    },
    { session },
  );

  if (orderUpdate.modifiedCount > 0) {
    logger.info("WEBHOOK", "Order payment reconciled", {
      eventId: event.id,
      razorpayOrderId: payment.order_id,
    });
  }

  const bookingUpdate = await db.collection("bookings").updateOne(
    {
      razorpay_order_id: payment.order_id,
      status: "requested",
      bookingFeeStatus: { $ne: "paid" },
    },
    {
      $set: {
        bookingFeeStatus: "paid",
        razorpay_payment_id: payment.id,
        updatedAt: new Date(),
      },
    },
    { session },
  );

  if (bookingUpdate.modifiedCount > 0) {
    logger.info("WEBHOOK", "Booking fee reconciled", {
      eventId: event.id,
      razorpayOrderId: payment.order_id,
    });
  }
}

// ─── payment.failed ──────────────────────────────────────────────────

export async function handlePaymentFailed(
  event: { id: string; payload: { payment: { entity: Record<string, unknown> } } },
  db: Db,
  session: ClientSession,
): Promise<void> {
  const payment = event.payload.payment.entity;
  await db.collection("payments").updateOne(
    { razorpay_payment_id: payment.id },
    {
      $set: {
        status: "failed",
        error_code: payment.error_code,
        error_description: payment.error_description,
        event_id: event.id,
        updatedAt: new Date(),
      },
    },
    { session },
  );

  await db.collection("orders").updateOne(
    {
      razorpay_order_id: payment.order_id,
      payment_status: "unpaid",
    },
    {
      $set: {
        payment_last_error:
          payment.error_description || "payment_failed",
        payment_last_error_code: payment.error_code || null,
        updatedAt: new Date(),
      },
    },
    { session },
  );

  logger.warn("WEBHOOK", "Payment failed", {
    paymentId: payment.id,
    error: payment.error_description,
  });
}

// ─── refund.created ──────────────────────────────────────────────────

export async function handleRefundCreated(
  event: { id: string; payload: { refund: { entity: Record<string, unknown> } } },
  db: Db,
  session: ClientSession,
): Promise<void> {
  const refund = event.payload.refund.entity;
  const refundAmount = round2((refund.amount as number) / 100);

  await db.collection("refunds").updateOne(
    { razorpay_refund_id: refund.id },
    {
      $set: {
        payment_id: refund.payment_id,
        amount: refundAmount,
        currency: refund.currency,
        status: refund.status,
        notes: refund.notes,
        event_id: event.id,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true, session },
  );

  logger.info("WEBHOOK", "Refund created", {
    refundId: refund.id,
    amount: refundAmount,
  });

  const order = await db.collection("orders").findOne(
    { razorpay_payment_id: refund.payment_id },
    {
      projection: {
        _id: 1,
        total_price: 1,
        refund_amount: 1,
        razorpay_refund_id: 1,
      },
      session,
    },
  );

  if (order?._id) {
    const existingRefundAmount = Number(order.refund_amount || 0);
    const alreadyApplied = order.razorpay_refund_id === refund.id;
    const nextRefundAmount = alreadyApplied
      ? round2(existingRefundAmount)
      : round2(existingRefundAmount + refundAmount);
    const totalAmount = round2(Number(order.total_price || 0));
    const isFullRefund =
      totalAmount > 0 &&
      nextRefundAmount >= totalAmount - MONEY_EPSILON;

    const orderSet: Record<string, unknown> = {
      refund_amount: nextRefundAmount,
      razorpay_refund_id: refund.id,
      refund_at: new Date(),
      updatedAt: new Date(),
    };

    if (isFullRefund) {
      orderSet.payment_status = "refunded";
    }

    await db.collection("orders").updateOne(
      { _id: order._id },
      { $set: orderSet },
      { session },
    );
  }

  await db.collection("bookings").updateOne(
    {
      razorpay_payment_id: refund.payment_id,
      bookingFeeStatus: { $in: ["paid", "applied"] },
    },
    {
      $set: {
        bookingFeeStatus: "refunded",
        refundProcessedAt: new Date(),
        booking_fee_refund_id: refund.id,
        updatedAt: new Date(),
      },
      $unset: {
        refund_in_progress_at: "",
      },
    },
    { session },
  );
}

// ─── payout.processed / payout.failed / payout.reversed / payout.rejected ──

export async function handlePayoutStatusUpdate(
  event: { id: string; payload: { payout: { entity: Record<string, unknown> } } },
  db: Db,
  session: ClientSession,
): Promise<void> {
  const payout = event.payload.payout.entity;
  const isProcessed = payout.status === "processed";
  const isFailedLike =
    payout.status === "failed" ||
    payout.status === "rejected" ||
    payout.status === "reversed" ||
    payout.status === "cancelled";
  const normalizedBookingPayoutStatus = isProcessed
    ? "paid"
    : isFailedLike
      ? "failed"
      : "processing";

  const bookingSet: Record<string, unknown> = {
    payout_status: normalizedBookingPayoutStatus,
    payout_utr: payout.utr,
    payout_updated_at: new Date(),
    bookingFeeStatus: isProcessed ? "applied" : "paid",
    updatedAt: new Date(),
  };

  const bookingUnset: Record<string, string> = {};
  if (isProcessed) {
    bookingSet.booking_fee_applied_at = new Date();
  } else {
    bookingUnset.booking_fee_applied_at = "";
  }

  await db.collection("orders").updateOne(
    { payout_id: payout.id },
    {
      $set: {
        payout_status: payout.status,
        payout_utr: payout.utr,
        payout_updated_at: new Date(),
      },
    },
    { session },
  );

  await db.collection("bookings").updateOne(
    { payout_id: payout.id },
    {
      $set: bookingSet,
      ...(Object.keys(bookingUnset).length > 0
        ? { $unset: bookingUnset }
        : {}),
    },
    { session },
  );

  logger.info("WEBHOOK", "Payout status reconciled", {
    payoutId: payout.id,
    status: payout.status,
    utr: payout.utr,
  });
}
