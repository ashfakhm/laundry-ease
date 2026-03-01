/**
 * Shared cron endpoint authentication.
 *
 * Extracted from the three cron routes that all perform the same
 * CRON_SECRET bearer-token check.
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";

export function requireCronSecret(req: Request): void {
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured — cron endpoint disabled");
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      503,
      "Cron endpoint not configured",
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized");
  }
}
