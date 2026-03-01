import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { withTransaction } from "@/lib/db/transaction";
import {
  handlePaymentCaptured,
  handlePaymentFailed,
  handleRefundCreated,
  handlePayoutStatusUpdate,
} from "@/lib/webhooks/razorpay-handlers";

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
      case "payment.captured":
        await withTransaction((session) =>
          handlePaymentCaptured(event, db, session),
        );
        break;

      case "payment.failed":
        await withTransaction((session) =>
          handlePaymentFailed(event, db, session),
        );
        break;

      case "refund.created":
        await withTransaction((session) =>
          handleRefundCreated(event, db, session),
        );
        break;

      case "payout.processed":
      case "payout.failed":
      case "payout.reversed":
      case "payout.rejected":
        await withTransaction((session) =>
          handlePayoutStatusUpdate(event, db, session),
        );
        break;

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
