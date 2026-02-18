import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processEligibleEscrowPayouts } from "@/lib/payouts";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

  const run = await startCronRun("release-payouts");

  try {
    const result = await processEligibleEscrowPayouts({
      source: "cron_release_payouts",
    });

    await completeCronRun(run.insertedId, "success", {
      processed: result.processed,
      results: result.results,
    });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      results: result.results,
    });
  } catch (error: unknown) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Cron payout error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
