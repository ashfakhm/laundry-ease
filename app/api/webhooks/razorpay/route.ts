import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

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
 */
export async function POST(req: NextRequest) {
  try {
    const webhookSignature = req.headers.get("x-razorpay-signature");
    const webhookBody = await req.text();

    if (!webhookSignature) {
      logger.warn("WEBHOOK", "Missing Razorpay signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(webhookBody)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    if (
      !crypto.timingSafeEqual(
        Buffer.from(webhookSignature),
        Buffer.from(expectedSignature)
      )
    ) {
      logger.error("WEBHOOK", "Invalid Razorpay webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(webhookBody);
    logger.info("WEBHOOK", `Received Razorpay event: ${event.event}`, {
      eventId: event.id,
      entity: event.entity,
    });

    const { db } = await getDb();

    // Handle different event types
    switch (event.event) {
      case "payment.authorized":
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        // Update payment status in database if needed
        // Most payments are already verified client-side, but this is a backup
        await db.collection("payments").updateOne(
          { razorpay_payment_id: payment.id },
          {
            $set: {
              status: payment.status,
              amount: payment.amount / 100, // Convert from paise
              currency: payment.currency,
              method: payment.method,
              updated_at: new Date(),
            },
            $setOnInsert: {
              razorpay_order_id: payment.order_id,
              created_at: new Date(),
            },
          },
          { upsert: true }
        );
        logger.info("WEBHOOK", "Payment status updated", {
          paymentId: payment.id,
          status: payment.status,
        });
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        await db.collection("payments").updateOne(
          { razorpay_payment_id: payment.id },
          {
            $set: {
              status: "failed",
              error_code: payment.error_code,
              error_description: payment.error_description,
              updated_at: new Date(),
            },
          }
        );
        logger.warn("WEBHOOK", "Payment failed", {
          paymentId: payment.id,
          error: payment.error_description,
        });
        break;
      }

      case "refund.created": {
        const refund = event.payload.refund.entity;
        await db.collection("refunds").updateOne(
          { razorpay_refund_id: refund.id },
          {
            $set: {
              payment_id: refund.payment_id,
              amount: refund.amount / 100,
              currency: refund.currency,
              status: refund.status,
              notes: refund.notes,
              updated_at: new Date(),
            },
            $setOnInsert: {
              created_at: new Date(),
            },
          },
          { upsert: true }
        );
        logger.info("WEBHOOK", "Refund created", {
          refundId: refund.id,
          amount: refund.amount / 100,
        });
        break;
      }

      case "payout.processed": {
        const payout = event.payload.payout.entity;
        // Update payout status in orders
        await db.collection("orders").updateOne(
          { payout_id: payout.id },
          {
            $set: {
              payout_status: payout.status,
              payout_utr: payout.utr,
              payout_updated_at: new Date(),
            },
          }
        );
        logger.info("WEBHOOK", "Payout processed", {
          payoutId: payout.id,
          status: payout.status,
          utr: payout.utr,
        });
        break;
      }

      default:
        logger.debug("WEBHOOK", `Unhandled event type: ${event.event}`, {
          eventId: event.id,
        });
    }

    // Store webhook event for audit
    await db.collection("webhook_events").insertOne({
      event_id: event.id,
      event_type: event.event,
      entity: event.entity,
      payload: event.payload,
      received_at: new Date(),
      processed: true,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("WEBHOOK", "Error processing Razorpay webhook", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
