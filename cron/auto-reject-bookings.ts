// cron/auto-reject-bookings.ts
// Background job: Auto-rejects bookings not accepted by provider within 2 hours

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

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
        console.log(
          `[AUTO-REJECT] Booking fee refunded for booking ${booking._id}`
        );
      } catch (err) {
        console.error(
          `[AUTO-REJECT] Failed to refund booking fee for booking ${booking._id}:`,
          err
        );
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
    console.log(`[AUTO-REJECT] Booking ${booking._id} auto-rejected.`);
  }
}
