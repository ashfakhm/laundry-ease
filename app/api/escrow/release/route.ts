import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processEligibleEscrowPayouts } from "@/lib/payouts";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error(
      "ESCROW",
      "CRON_SECRET not configured - escrow release endpoint disabled",
    );
    return NextResponse.json({
      success: false,
      error: "Endpoint not configured"
    }, {
      status: 503
    });
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({
      success: false,
      error: "Unauthorized"
    }, {
      status: 401
    });
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
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
