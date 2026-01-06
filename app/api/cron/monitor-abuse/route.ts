import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// GET /api/cron/monitor-abuse
export async function GET(req: NextRequest) {
  // Verify Cron Secret - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET not configured - cron endpoint disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    for (const item of cancelledBookings) {
      // Assuming SeekerDetails is in 'users' collection or similar, or 'seekers'
      // Based on db.ts Seeker collection is 'seekers'
      await db
        .collection("seekers")
        .updateOne(
          { _id: item._id },
          { $set: { isFlagged: true, flagReason: "Excessive Cancellations" } }
        );
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
    console.error("Abuse Monitor Error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
