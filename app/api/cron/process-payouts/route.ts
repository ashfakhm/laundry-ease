import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processEligibleEscrowPayouts } from "@/lib/payouts";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { telemetry } from "@/lib/telemetry";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!env.CRON_SECRET) {
      logger.error(
        "CRON",
        "CRON_SECRET not configured - cron endpoint disabled",
      );
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

    const run = await startCronRun("process-payouts");

    try {
      const result = await processEligibleEscrowPayouts({
        source: "cron_process_payouts",
      });

      await completeCronRun(run.insertedId, "success", {
        processed: result.processed,
        results: result.results,
      });

      const successCount = result.results.filter(
        (r) => r.status === "payout_initiated",
      ).length;
      const failedCount = result.results.filter((r) =>
        r.status.startsWith("failed_"),
      ).length;

      telemetry.increment("payouts.processed", result.processed);
      if (successCount > 0)
        telemetry.increment("payouts.success", successCount);
      if (failedCount > 0) telemetry.increment("payouts.failure", failedCount);

      return successResponse({
        processed: result.processed,
        results: result.results,
      });
    } catch (error) {
      await completeCronRun(run.insertedId, "error", undefined, error);
      throw error;
    }
  } catch (error: unknown) {
    logger.error("CRON", "Process payouts cron error", error);
    return errorResponse(error);
  }
}
