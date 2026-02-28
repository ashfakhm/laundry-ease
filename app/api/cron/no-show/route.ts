import { checkNoShows } from "@/cron/no-show-check";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { errorResponse, successResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";

export async function GET(req: Request) {
  // Authenticate Cron requests - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 503, "Cron endpoint not configured"));
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
  }

  const run = await startCronRun("no-show");

  try {
    const results = await checkNoShows();

    await completeCronRun(run.insertedId, "success", results);

    return successResponse({ results });
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "No-show cron job failed", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Server Error"));
  }
}
