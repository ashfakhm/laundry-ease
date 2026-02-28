import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { withTransaction } from "@/lib/db/transaction";

const MONEY_EPSILON = 0.01;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Razorpay Webhook Handler
 * Verifies webhook signatures and processes payment events
 *
 * Webhook events to handle:
 * - payment.authorized
 * - payment.captured
 * - payment.failed
 * - order.paid
 * - refund.created
 * - payout.processed
 * - payout.failed
 * - payout.reversed
 * - payout.rejected
 */
export async function POST(req: NextRequest) {
  let eventId: string | undefined;

  try {
    const webhookSignature = req.headers.get("x-razorpay-signature");
    const webhookBody = await req.text();

    if (!webhookSignature) {
      logger.warn("WEBHOOK", "Missing Razorpay signature header");
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Missing signature");
    }

    // Verify webhook signature (Regex check)
    if (!/^[a-f0-9]{64}$/i.test(webhookSignature)) {
      logger.error("WEBHOOK", "Malformed Razorpay webhook signature");
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid signature");
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(webhookBody)
      .digest("hex");
    const signatureBuffer = Buffer.from(webhookSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    // Constant-time comparison to prevent timing attacks
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      logger.error("WEBHOOK", "Invalid Razorpay webhook signature");
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid signature");
    }

    const event = JSON.parse(webhookBody);
    if (!event?.id || !event?.event) {
      logger.warn("WEBHOOK", "Invalid webhook payload: missing id/event");
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid payload");
    }

    eventId = event.id;
    logger.info("WEBHOOK", `Received Razorpay event: ${event.event}`, {
      eventId: event.id,
      entity: event.entity,
    });

    const { db } = await getDb();
    const webhookEvents = db.collection("webhook_events");

    // Idempotency and locking guard:
    const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

    const existingEvent = await webhookEvents.findOneAndUpdate(
      { event_id: event.id },
      {
        $setOnInsert: {
          event_type: event.event,
          entity: event.entity,
          payload: event.payload,
          received_at: new Date(),
          processed: false,
          processing_started_at: new Date(),
        },
      },
      { upsert: true, returnDocument: "before" },
    );

    if (existingEvent) {
      if (existingEvent.processed) {
        logger.info("WEBHOOK", "Duplicate webhook event ignored", {
          eventId: event.id,
          eventType: event.event,
        });
        return successResponse({ received: true, duplicate: true });
      }

      // Check if another instance is currently processing this event
      const now = new Date();
      const lockTime = existingEvent.processing_started_at?.getTime() || 0;

      if (now.getTime() - lockTime < LOCK_TIMEOUT_MS) {
        logger.info("WEBHOOK", "Webhook currently processing, ignoring", {
          eventId: event.id,
        });
        return successResponse({ received: true, processing: true });
      }

      // Try to acquire the lock for retry if the previous lock timed out
      const retryLock = await webhookEvents.findOneAndUpdate(
        {
          event_id: event.id,
          processed: false,
          $or: [
            { processing_started_at: { $exists: false } },
            { processing_started_at: null },
            {
              processing_started_at: {
                $lt: new Date(now.getTime() - LOCK_TIMEOUT_MS),
              },
            },
          ],
        },
        {
          $set: {
            processing_started_at: new Date(),
            processing_error: null,
            retry_started_at: new Date(),
          },
        },
      );

      if (!retryLock) {
        logger.info("WEBHOOK", "Failed to acquire retry lock, ignoring", {
          eventId: event.id,
        });
        return successResponse({ received: true, processing: true });
      }
    }

    // Handle different event types
    switch (event.event) {
      case "payment.authorized":
      case "payment.captured": {
        await withTransaction(async (session) => {
          const payment = event.payload.payment.entity;
          const paidAt = payment.captured_at
            ? new Date(payment.captured_at * 1000)
            : new Date();

          // Update payment status in database
          await db.collection("payments").updateOne(
            { razorpay_payment_id: payment.id },
            {
              $set: {
                status: payment.status,
                amount: payment.amount / 100, // Convert from paise
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
          logger.info("WEBHOOK", "Payment status updated", {
            paymentId: payment.id,
            status: payment.status,
          });

          // Reconcile order state from payment provider data.
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

          // Reconcile booking fee payment only for booking-fee flow.
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
        });
        break;
      }

      case "payment.failed": {
        await withTransaction(async (session) => {
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
        });
        break;
      }

      case "refund.created": {
        await withTransaction(async (session) => {
          const refund = event.payload.refund.entity;
          const refundAmount = round2(refund.amount / 100);
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
              {
                $set: orderSet,
              },
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
        });
        break;
      }

      case "payout.processed":
      case "payout.failed":
      case "payout.reversed":
      case "payout.rejected": {
        await withTransaction(async (session) => {
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

          // Update payout status in orders
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
        });
        break;
      }

      default:
        logger.debug("WEBHOOK", `Unhandled event type: ${event.event}`, {
          eventId: event.id,
        });
    }

    await webhookEvents.updateOne(
      { event_id: event.id },
      {
        $set: {
          processed: true,
          processed_at: new Date(),
          processing_error: null,
        },
      },
    );

    return successResponse({ received: true });
  } catch (error) {
    if (eventId) {
      try {
        const { db } = await getDb();
        await db.collection("webhook_events").updateOne(
          { event_id: eventId },
          {
            $set: {
              processed: false,
              processing_started_at: null,
              processing_error:
                error instanceof Error ? error.message : String(error),
              failed_at: new Date(),
            },
          },
        );
      } catch (markErr) {
        logger.error(
          "WEBHOOK",
          "Failed to persist webhook processing error",
          markErr,
          {
            eventId,
          },
        );
      }
    }

    logger.error("WEBHOOK", "Error processing Razorpay webhook", error);
    return errorResponse(error);
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      ok: false,
      message: "Method not allowed",
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      },
    },
    { status: 405 },
  );
}
