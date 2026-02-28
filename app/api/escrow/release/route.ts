import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processEligibleEscrowPayouts } from "@/lib/payouts";
import { errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error(
      "ESCROW",
      "CRON_SECRET not configured - escrow release endpoint disabled",
    );
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 503, "Endpoint not configured"));
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
  }

  try {
    const result = await processEligibleEscrowPayouts({
      source: "escrow_release_endpoint",
    });

    return NextResponse.json({
      success: true,
      message: "Escrow payout processing completed",
      processed: result.processed,
      results: result.results
    }, {
      status: 200
    });
  } catch (error: unknown) {
    logger.error("ESCROW", "Error processing escrow payouts", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
