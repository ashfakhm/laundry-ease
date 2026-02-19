/**
 * Cron job observability — tracks every cron run in MongoDB.
 *
 * Usage in any cron route handler:
 *   const run = await startCronRun("process-payouts");
 *   try {
 *     const result = await doWork();
 *     await completeCronRun(run.insertedId, "success", result);
 *   } catch (error) {
 *     await completeCronRun(run.insertedId, "error", undefined, error);
 *     throw error;
 *   }
 */

import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import type { CronJobName } from "@/lib/constants";
import type { ObjectId } from "mongodb";

export interface CronRunDocument {
  _id?: ObjectId;
  job: CronJobName;
  status: "running" | "success" | "error";
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: unknown;
  error?: string;
}

export interface CronRunStartResult {
  acknowledged: boolean;
  insertedId: ObjectId | null;
}

/**
 * Record the start of a cron job run.
 * Returns a minimal result payload so callers can reference the _id.
 */
export async function startCronRun(
  job: CronJobName,
): Promise<CronRunStartResult> {
  try {
    const { db } = await getDb();
    const result = await db.collection<CronRunDocument>("cron_runs").insertOne({
      job,
      status: "running",
      startedAt: new Date(),
    });
    return {
      acknowledged: result.acknowledged,
      insertedId: result.insertedId,
    };
  } catch (err) {
    logger.error("CRON_TRACKING", `Failed to record start of ${job}`, err);
    // Return a stub so callers don't crash — observability should never
    // break the actual cron logic.
    return { acknowledged: false, insertedId: null };
  }
}

/**
 * Record the completion of a cron job run.
 */
export async function completeCronRun(
  runId: ObjectId | null,
  status: "success" | "error",
  result?: unknown,
  error?: unknown,
): Promise<void> {
  if (!runId) return; // startCronRun failed — nothing to update

  try {
    const now = new Date();
    const { db } = await getDb();
    const updateDoc: Record<string, unknown> = {
      status,
      completedAt: now,
    };

    // Compute duration from the original startedAt
    const existing = await db
      .collection<CronRunDocument>("cron_runs")
      .findOne({ _id: runId });
    if (existing?.startedAt) {
      updateDoc.durationMs = now.getTime() - existing.startedAt.getTime();
    }

    if (result !== undefined) {
      // Limit stored result size to avoid bloating the collection
      updateDoc.result =
        typeof result === "string"
          ? result.slice(0, 2000)
          : JSON.parse(JSON.stringify(result ?? null));
    }

    if (error) {
      updateDoc.error =
        error instanceof Error
          ? `${error.message}\n${error.stack ?? ""}`
          : String(error);
    }

    await db
      .collection<CronRunDocument>("cron_runs")
      .updateOne({ _id: runId }, { $set: updateDoc });
  } catch (err) {
    logger.error("CRON_TRACKING", "Failed to record cron completion", err);
  }
}
