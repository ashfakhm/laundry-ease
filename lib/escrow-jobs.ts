import {
  processEligibleEscrowPayouts,
  type PayoutResult,
} from "@/lib/payouts";

/**
 * Escrow payout processing job logic.
 * Uses the same unified payout orchestration as API cron endpoints.
 */
export async function releaseEscrowPaymentsJob() {
  const batch = await processEligibleEscrowPayouts({
    source: "script_escrow_auto_release",
  });

  const released: string[] = [];
  const failed: string[] = [];

  for (const result of batch.results) {
    if (isReleaseSuccess(result)) {
      released.push(result.orderId);
      continue;
    }

    if (isReleaseFailure(result)) {
      failed.push(result.orderId);
    }
  }

  return {
    processed: batch.processed,
    released,
    failed,
    results: batch.results,
  };
}

function isReleaseSuccess(result: PayoutResult): boolean {
  return (
    result.status === "payout_initiated" ||
    result.status === "already_paid_out" ||
    result.status === "already_processing"
  );
}

function isReleaseFailure(result: PayoutResult): boolean {
  return (
    result.status === "blocked_by_complaint" ||
    result.status === "escrow_release_blocked" ||
    result.status === "failed_no_fund_account" ||
    result.status === "failed_account_not_configured" ||
    result.status === "failed_invalid_amount" ||
    result.status === "failed_razorpay_error"
  );
}
