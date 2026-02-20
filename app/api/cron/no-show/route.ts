// no NextRequest needed
import {
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";
import { checkNoShows } from "@/cron/no-show-check";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";

export async function GET(req: Request) {
  // Authenticate Cron requests - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return legacyErrorResponse("Cron endpoint not configured", 503);
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return legacyErrorResponse("Unauthorized", 401);
  }

  const run = await startCronRun("no-show");

  try {
    const results = await checkNoShows();

    await completeCronRun(run.insertedId, "success", results);

    return legacySuccessResponse({ results });
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "No-show cron job failed", error);
    return legacyErrorResponse("Internal Server Error", 500);
  }
}
