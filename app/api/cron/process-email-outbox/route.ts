import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { processEmailOutboxBatch } from "@/lib/email-outbox";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseBatchLimit(rawLimit: string | null): number {
  if (!rawLimit) return DEFAULT_LIMIT;
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}

// GET /api/cron/process-email-outbox
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - email outbox disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await startCronRun("process-email-outbox");

  try {
    const url = new URL(req.url);
    const limit = parseBatchLimit(url.searchParams.get("limit"));
    const result = await processEmailOutboxBatch({
      limit,
      workerId: "cron:process-email-outbox",
    });

    const response = {
      success: true,
      ...result,
      limit,
      processedAt: new Date().toISOString(),
    };

    await completeCronRun(run.insertedId, "success", response);
    return NextResponse.json(response);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Email outbox cron failed", error);
    return NextResponse.json(
      { error: "Email outbox processing failed" },
      { status: 500 },
    );
  }
}
