import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";

/**
 * SIMULATED CRON JOB
 * In a real Vercel deployment, this would be a Vercel Cron Job endpoint.
 * For now, it's a script we can run or call via API to check for no-shows.
 *
 * Logic:
 * If pickupSlot.confirmedAt exists AND
 * Current Time > pickupSlot.dateTime + 30 minutes AND
 * status is NOT "picked_up" (Wait, status is in 'Order' usually, but 'Booking' handle pre-pickup)
 * Actually, once order is created, booking status is sort of done?
 * PRD says: "If provider does not appear... Booking is auto-cancelled"
 * So if no Order has been created yet?
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
      status: "accepted",
      "pickupSlot.confirmedAt": { $exists: true },
      "pickupSlot.dateTime": { $lt: new Date(now.getTime() - bufferTime) },
      noShowStatus: { $ne: true }, // Not already marked
    })
    .toArray();

  const results = [];

  for (const booking of overdueBookings) {
    // Step 2: Check if an order exists for this booking
    const order = await db
      .collection("orders")
      .findOne({ booking_id: booking._id });

    if (!order) {
      // MARK AS NO-SHOW
      await db.collection<Booking>("bookings").updateOne(
        { _id: booking._id },
        {
          $set: {
            noShowStatus: true,
            status: "rejected", // Auto-cancel basically
          },
        }
      );
      results.push(`Marked Booking ${booking._id} as No-Show`);
      logger.info("NO-SHOW", `Booking marked as No-Show`, {
        bookingId: booking._id.toString(),
      });
    }
  }

  return results;
}
