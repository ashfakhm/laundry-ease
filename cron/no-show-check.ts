import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";

/**
 * No-show detection cron job.
 *
 * Invoked by the Vercel Cron scheduler (see vercel.json) on a scheduled interval.
 * Also callable on-demand via the internal cron API route for manual triggering.
 *
 * Logic:
 *   - Find confirmed bookings where pickupSlot.confirmedAt is set AND
 *     pickupSlot.dateTime + 30 min buffer has passed AND
 *     no corresponding Order exists yet (provider never showed up / started work).
 *   - Auto-cancel those bookings, issue a refund of the booking fee to the seeker,
 *     and fire alert notifications to both parties.
 */

export async function checkNoShows() {
  const { db } = await getDb();
  const now = new Date();
  const bufferTime = 30 * 60 * 1000; // 30 mins

  // Find confirmed bookings where pickup time + 30m < now
  // AND which do NOT have a corresponding Order created yet
  // (Implies provider hasn't picked up/created invoice)

  // Step 1: Get potentially missed bookings
  const overdueBookings = await db
    .collection<Booking>("bookings")
    .find({
      status: "confirmed",
      "pickupSlot.confirmedAt": { $exists: true },
      "pickupSlot.dateTime": { $lt: new Date(now.getTime() - bufferTime) },
      noShowStatus: { $ne: true }, // Not already marked
    })
    .toArray();

  const results = [];

  for (const booking of overdueBookings) {
    try {
      // Step 2: Check if an order exists for this booking
      const order = await db
        .collection("orders")
        .findOne({ booking_id: booking._id });

      if (!order) {
        // IDEMPOTENCY: Only update if still in "confirmed" status and not already marked
        // Atomic update prevents double-processing
        const updateResult = await db.collection<Booking>("bookings").updateOne(
          {
            _id: booking._id,
            status: "confirmed", // Only update if still confirmed (idempotent)
            noShowStatus: { $ne: true }, // Double-check not already marked
          },
          {
            $set: {
              noShowStatus: true,
              status: "rejected", // Auto-cancel basically
              noShowMarkedAt: new Date(),
            },
          },
        );

        // If update didn't match, booking was already processed (idempotent - skip)
        if (updateResult.matchedCount > 0) {
          if (
            booking.bookingFeeStatus === "paid" &&
            booking.razorpay_payment_id &&
            !booking.refundProcessedAt
          ) {
            try {
              const refund = await refundRazorpayPayment(
                booking.razorpay_payment_id,
                undefined,
                {
                  reason: "provider_no_show_auto_reject",
                  booking_id: booking._id.toString(),
                },
              );

              await db.collection<Booking>("bookings").updateOne(
                {
                  _id: booking._id,
                  bookingFeeStatus: "paid",
                },
                {
                  $set: {
                    bookingFeeStatus: "refunded",
                    refundProcessedAt: new Date(),
                    ...(refund.id ? { booking_fee_refund_id: refund.id } : {}),
                  },
                },
              );
            } catch (refundError) {
              logger.error(
                "NO-SHOW",
                "Failed to refund booking fee for no-show booking",
                refundError,
                {
                  bookingId: booking._id.toString(),
                },
              );
            }
          }

          results.push(`Marked Booking ${booking._id} as No-Show`);
          logger.info("NO-SHOW", `Booking marked as No-Show`, {
            bookingId: booking._id.toString(),
          });
        } else {
          logger.debug(
            "NO-SHOW",
            `Booking already processed (idempotent skip)`,
            {
              bookingId: booking._id.toString(),
            },
          );
        }
      }
    } catch (err) {
      logger.error("NO-SHOW", `Failed to process no-show check`, err, {
        bookingId: booking._id.toString(),
      });
    }
  }

  return results;
}
