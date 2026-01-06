import { NextResponse } from "next/server";
import { checkNoShows } from "@/cron/no-show-check";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  // Authenticate Cron requests - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await checkNoShows();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    logger.error("CRON", "No-show cron job failed", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
