import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireCronSecret } from "@/lib/api/cron-auth";

/**
 * Webhook Archival Config
 * Purge events older than 30 days that have successfully processed.
 */
const RETENTION_DAYS = 30;

// GET /api/cron/webhook-cleanup
export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);
  } catch (error) {
    return errorResponse(error);
  }

  const run = await startCronRun("webhook-cleanup");

  try {
    const { db } = await getDb();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const deleteResult = await db.collection("webhook_events").deleteMany({
      processed: true,
      received_at: { $lt: cutoffDate },
    });

    const results = {
      cutoffDate,
      purgedCount: deleteResult.deletedCount,
    };

    logger.info("CRON", `Webhook payload cleanup complete`, results);
    await completeCronRun(run.insertedId, "success", results);

    return successResponse(results);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Webhook cleanup failed", error);
    return errorResponse(error);
  }
}
