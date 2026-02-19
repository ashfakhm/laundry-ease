import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processEligibleEscrowPayouts } from "@/lib/payouts";
import {
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error(
      "ESCROW",
      "CRON_SECRET not configured - escrow release endpoint disabled",
    );
    return legacyErrorResponse("Endpoint not configured", 503);
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return legacyErrorResponse("Unauthorized", 401);
  }

  try {
    const result = await processEligibleEscrowPayouts({
      source: "escrow_release_endpoint",
    });

    return legacySuccessResponse({
      message: "Escrow payout processing completed",
      processed: result.processed,
      results: result.results,
    });
  } catch (error: unknown) {
    logger.error("ESCROW", "Error processing escrow payouts", error);
    return legacyErrorResponse("Internal server error", 500);
  }
}
