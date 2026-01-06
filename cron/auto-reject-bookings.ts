// cron/auto-reject-bookings.ts
// Background job: Auto-rejects bookings not accepted by provider within 2 hours

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";

/**
 * Auto-rejects bookings not accepted by provider within 2 hours
 * To be called by a cron runner (e.g., every 10 minutes)
 */
export async function autoRejectStaleBookings() {
  const { db } = await getDb();
  const now = new Date();
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
    // Refund booking fee if paid
    if (booking.bookingFeeStatus === "paid" && booking.paymentId) {
      try {
        const { refundRazorpayPayment } = await import("@/lib/razorpay");
        await refundRazorpayPayment(booking.paymentId, booking.bookingFee);
        await db.collection("bookings").updateOne(
          {
            _id:
              typeof booking._id === "string"
                ? new ObjectId(booking._id)
                : booking._id,
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
      } catch (err) {
        logger.error("AUTO-REJECT", `Failed to refund booking fee`, err, {
          bookingId: booking._id.toString(),
        });
      }
    }
    await db.collection("bookings").updateOne(
      {
        _id:
          typeof booking._id === "string"
            ? new ObjectId(booking._id)
            : booking._id,
      },
      {
        $set: {
          status: "rejected",
          autoRejected: true,
          autoRejectReason: "Provider did not respond in 2 hours.",
        },
      }
    );
    logger.info("AUTO-REJECT", `Booking auto-rejected`, {
      bookingId: booking._id.toString(),
    });
  }
}
