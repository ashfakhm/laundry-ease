import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

// GET /api/cron/monitor-abuse
export async function GET(req: NextRequest) {
  // Verify Cron Secret - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find users with excessive cancellations (>3 in 30 days)
    const cancelledBookings = await db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            status: "cancelled",
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: "$seeker_id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 3 } } },
      ])
      .toArray();

    // Flag Seeker Users
    // IDEMPOTENCY: Using $set is safe - it's idempotent to set same values again
    // However, we should preserve existing flagReason if already flagged (use $addToSet or conditional)
    for (const item of cancelledBookings) {
      try {
        const seeker = await db.collection("seekers").findOne({ _id: item._id });
        
        // Only update if not already flagged for this reason (preserve existing flags)
        if (seeker && (!seeker.isFlagged || seeker.flagReason !== "Excessive Cancellations")) {
          await db
            .collection("seekers")
            .updateOne(
              { _id: item._id },
              {
                $set: {
                  isFlagged: true,
                  flagReason: "Excessive Cancellations",
                  flaggedAt: new Date(),
                  cancellationCount: item.count, // Store the count for reference
                },
              }
            );
          logger.info("ABUSE-MONITOR", `Flagged seeker for excessive cancellations`, {
            seekerId: item._id.toString(),
            count: item.count,
          });
        }
      } catch (err) {
        logger.error("ABUSE-MONITOR", `Failed to flag seeker`, err, {
          seekerId: item._id.toString(),
        });
      }
    }

    // Can add similar logic for Providers or Disputes

    return NextResponse.json({
      success: true,
      flaggedCount: cancelledBookings.length,
      flaggedUsers: cancelledBookings.map((b) => b._id),
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("CRON", "Abuse monitor error", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
