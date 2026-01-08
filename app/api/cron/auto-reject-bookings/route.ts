import { NextRequest, NextResponse } from "next/server";
import { autoRejectStaleBookings } from "@/cron/auto-reject-bookings";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  try {
    // Authorization check - CRITICAL for production security
    const authHeader = req.headers.get("authorization");
    if (!env.CRON_SECRET) {
      logger.error(
        "CRON",
        "CRON_SECRET not configured - cron endpoint disabled"
      );
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 503 }
      );
    }

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await autoRejectStaleBookings();

    return NextResponse.json({
      success: true,
      message: "Auto-reject bookings cron completed",
      result,
    });
  } catch (error) {
    logger.error("CRON", "Auto-reject bookings cron failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
