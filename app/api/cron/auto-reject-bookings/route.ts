import { autoRejectStaleBookings } from "@/cron/auto-reject-bookings";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";

export async function GET(req: Request) {
  // Authenticate Cron requests - CRITICAL for production security
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - cron endpoint disabled");
    return errorResponse(
      new AppError(
        ErrorCode.VALIDATION_ERROR,
        503,
        "Cron endpoint not configured",
      ),
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return errorResponse(
      new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
    );
  }

  const run = await startCronRun("auto-reject-bookings");

  try {
    const result = await autoRejectStaleBookings();

    await completeCronRun(run.insertedId, "success", result);

    return successResponse(result);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Auto-reject cron job failed", error);
    return errorResponse(error);
  }
}
