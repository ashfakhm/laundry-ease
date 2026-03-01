import { Db } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";

type TriggerAlertOpts = {
  key: string;
  message: string;
  severity: "critical" | "high" | "medium";
};

/**
 * Insert a system alert using an existing Db handle.
 * Use this when calling from within index initialization to avoid
 * re-entering getDb() (which awaits the index-init promise).
 */
export async function triggerSystemAlertWithDb(
  db: Db,
  opts: TriggerAlertOpts,
): Promise<void> {
  try {
    const now = new Date();

    await db.collection("system_alerts").updateOne(
      {
        key: opts.key,
        status: "open",
      },
      {
        $set: {
          severity: opts.severity,
          message: opts.message,
          lastSeenAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          kind: "system_event",
          key: opts.key,
          entityType: "system",
          entityId: "system",
          status: "open",
          firstSeenAt: now,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error("OPS_ALERTS", "Failed to insert system alert (with db handle)", error);
  }
}

export async function triggerSystemAlert(
  opts: TriggerAlertOpts,
): Promise<void> {
  try {
    const { db } = await getDb();
    const now = new Date();

    await db.collection("system_alerts").updateOne(
      {
        key: opts.key,
        status: "open",
      },
      {
        $set: {
          severity: opts.severity,
          message: opts.message,
          lastSeenAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          kind: "system_event",
          key: opts.key,
          entityType: "system",
          entityId: "system",
          status: "open",
          firstSeenAt: now,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error("OPS_ALERTS", "Failed to insert system alert", error);
  }
}
