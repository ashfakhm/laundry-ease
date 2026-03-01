/**
 * Alert lifecycle: upsert open alerts and resolve disappeared ones.
 *
 * Shared by audit-integrity and monitor-operational-health cron routes
 * which both follow the same "upsert active, resolve vanished" pattern.
 */

import { Collection } from "mongodb";

export type AlertInput = {
  key: string;
  entityType: string;
  entityId: string;
  severity: string;
  message: string;
  context?: Record<string, unknown>;
};

type AlertLifecycleResult = {
  openedOrUpdated: number;
  resolvedCount: number;
};

export async function syncAlerts(
  collection: Collection,
  kind: string,
  alerts: AlertInput[],
  now: Date,
): Promise<AlertLifecycleResult> {
  const activeKeys = new Set(
    alerts.map((a) => `${a.key}:${a.entityType}:${a.entityId}`),
  );

  let openedOrUpdated = 0;

  if (alerts.length > 0) {
    const openOps = alerts.map((alert) => ({
      updateOne: {
        filter: {
          kind,
          key: alert.key,
          entityType: alert.entityType,
          entityId: alert.entityId,
          status: "open" as const,
        },
        update: {
          $set: {
            severity: alert.severity,
            message: alert.message,
            ...(alert.context ? { context: alert.context } : {}),
            lastSeenAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            kind,
            key: alert.key,
            entityType: alert.entityType,
            entityId: alert.entityId,
            status: "open" as const,
            firstSeenAt: now,
            createdAt: now,
          },
        },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(openOps, { ordered: false });
    openedOrUpdated =
      (result.upsertedCount || 0) + (result.modifiedCount || 0);
  }

  const existingOpen = await collection
    .find(
      { kind, status: "open" },
      { projection: { key: 1, entityType: 1, entityId: 1 } },
    )
    .toArray();

  const resolveOps = existingOpen
    .filter((alert) => {
      const id = `${alert.key}:${alert.entityType}:${alert.entityId}`;
      return !activeKeys.has(id);
    })
    .map((alert) => ({
      updateOne: {
        filter: {
          kind,
          key: alert.key,
          entityType: alert.entityType,
          entityId: alert.entityId,
          status: "open" as const,
        },
        update: {
          $set: {
            status: "resolved" as const,
            resolvedAt: now,
            updatedAt: now,
          },
        },
      },
    }));

  let resolvedCount = 0;
  if (resolveOps.length > 0) {
    const result = await collection.bulkWrite(resolveOps, { ordered: false });
    resolvedCount = result.modifiedCount || 0;
  }

  return { openedOrUpdated, resolvedCount };
}
