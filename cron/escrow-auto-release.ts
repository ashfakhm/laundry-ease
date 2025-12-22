import { releaseEscrowPaymentsJob } from "@/lib/escrow-jobs";

/**
 * SIMULATED CRON JOB
 * In a real deployment, this would be a scheduled endpoint or serverless cron.
 * This script runs the escrow auto-release logic.
 */
export async function runEscrowAutoReleaseJob() {
  return await releaseEscrowPaymentsJob();
}

// If you want to run this directly (e.g., `ts-node escrow-auto-release.ts`)
if (require.main === module) {
  runEscrowAutoReleaseJob().then((result) => {
    console.log("Escrow auto-release job result:", result);
    process.exit(0);
  });
}
