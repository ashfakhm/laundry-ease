// cron/auto-reject-bookings.ts
// Background job: Auto-rejects bookings not accepted by provider within 2 hours

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

/**
 * Auto-rejects bookings not accepted by provider within 2 hours
 * To be called by a cron runner (e.g., every 10 minutes)
 * @returns Summary of processed bookings
 */
export async function autoRejectStaleBookings(): Promise<{
  processed: number;
  refunded: number;
  failed: number;
}> {
  const { db } = await getDb();
  const now = new Date();
  let refunded = 0;
  let failed = 0;
  const bufferTime = 2 * 60 * 60 * 1000; // 2 hours

  // Find bookings in 'requested' state older than 2 hours
  const staleBookings = await db
    .collection("bookings")
    .find({
      status: "requested",
      createdAt: { $lt: new Date(now.getTime() - bufferTime) },
      autoRejected: { $ne: true },
    })
    .toArray();

  for (const booking of staleBookings) {
    const bookingId =
      typeof booking._id === "string" ? new ObjectId(booking._id) : booking._id;

    try {
      // IDEMPOTENCY: Update status first (atomic with condition) to prevent double-processing
      // This ensures if refund fails, we don't try again on next run
      const statusUpdateResult = await db.collection("bookings").updateOne(
        {
          _id: bookingId,
          status: "requested", // Only update if still in requested status (idempotent)
          autoRejected: { $ne: true }, // Double-check not already processed
        },
        {
          $set: {
            status: "rejected",
            autoRejected: true,
            autoRejectReason: "Provider did not respond in 2 hours.",
            autoRejectedAt: new Date(),
          },
        }
      );

      // If update didn't match, booking was already processed (idempotent - skip)
      if (statusUpdateResult.matchedCount === 0) {
        logger.info("AUTO-REJECT", `Booking already processed (idempotent skip)`, {
          bookingId: booking._id.toString(),
        });
        continue;
      }

      // Refund booking fee if paid (only attempt if status update succeeded)
      // IDEMPOTENCY: Check if already refunded before attempting refund
      if (
        booking.bookingFeeStatus === "paid" &&
        booking.razorpay_payment_id &&
        !booking.refundProcessedAt
      ) {
        try {
          const { refundRazorpayPayment } = await import("@/lib/razorpay");
          await refundRazorpayPayment(booking.razorpay_payment_id);
          
          // Atomic update: Only set refunded if bookingFeeStatus is still "paid" (idempotent)
          await db.collection("bookings").updateOne(
            {
              _id: bookingId,
              bookingFeeStatus: "paid", // Only update if still paid (prevents double-refund)
            },
            {
              $set: {
                bookingFeeStatus: "refunded",
                refundProcessedAt: new Date(),
              },
            }
          );
          logger.info("AUTO-REJECT", `Booking fee refunded`, {
            bookingId: booking._id.toString(),
          });
          refunded++;
        } catch (err) {
          logger.error("AUTO-REJECT", `Failed to refund booking fee`, err, {
            bookingId: booking._id.toString(),
          });
          failed++;
          // Status is already updated, so we won't retry refund on next run
          // Admin intervention may be needed for failed refunds
        }
      }

      logger.info("AUTO-REJECT", `Booking auto-rejected`, {
        bookingId: booking._id.toString(),
      });
    } catch (err) {
      logger.error("AUTO-REJECT", `Failed to process booking auto-reject`, err, {
        bookingId: booking._id.toString(),
      });
      failed++;
    }
  }

  return {
    processed: staleBookings.length,
    refunded,
    failed,
  };
}
