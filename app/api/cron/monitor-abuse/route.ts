import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  ABUSE_LOOKBACK_DAYS,
  EXCESSIVE_CANCELLATION_THRESHOLD,
} from "@/lib/constants";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";

// GET /api/cron/monitor-abuse
export async function GET(req: NextRequest) {
  // Verify Cron Secret - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await startCronRun("monitor-abuse");

  try {
    const { db } = await getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ABUSE_LOOKBACK_DAYS);

    // Find users with excessive cancellations
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
        { $match: { count: { $gt: EXCESSIVE_CANCELLATION_THRESHOLD } } },
      ])
      .toArray();

    // Flag Seeker Users
    for (const item of cancelledBookings) {
      try {
        const seeker = await db
          .collection("seekers")
          .findOne({ _id: item._id });

        if (
          seeker &&
          (!seeker.isFlagged || seeker.flagReason !== "Excessive Cancellations")
        ) {
          await db.collection("seekers").updateOne(
            { _id: item._id },
            {
              $set: {
                isFlagged: true,
                flagReason: "Excessive Cancellations",
                flaggedAt: new Date(),
                cancellationCount: item.count,
              },
            },
          );
          logger.info(
            "ABUSE-MONITOR",
            `Flagged seeker for excessive cancellations`,
            {
              seekerId: item._id.toString(),
              count: item.count,
            },
          );
        }
      } catch (err) {
        logger.error("ABUSE-MONITOR", `Failed to flag seeker`, err, {
          seekerId: item._id.toString(),
        });
      }
    }

    const result = {
      success: true,
      flaggedCount: cancelledBookings.length,
      flaggedUsers: cancelledBookings.map((b) => b._id),
    };

    await completeCronRun(run.insertedId, "success", result);

    return NextResponse.json(result);
  } catch (error: unknown) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("CRON", "Abuse monitor error", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
