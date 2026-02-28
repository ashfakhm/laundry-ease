import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { auditIntegrity, type IntegrityAnomaly } from "@/lib/audit/integrity";
import { STALE_PAYOUT_CUTOFF_MS } from "@/lib/constants";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";

type SystemAlertDocument = {
  kind: "integrity";
  key: string;
  entityType: "order" | "booking" | "complaint";
  entityId: string;
  severity: "critical" | "high" | "medium";
  message: string;
  status: "open" | "resolved";
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt?: Date;
  updatedAt: Date;
  createdAt: Date;
};

function anomalyId(anomaly: IntegrityAnomaly): string {
  return `${anomaly.key}:${anomaly.entityType}:${anomaly.entityId}`;
}

// GET /api/cron/audit-integrity
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error(
      "CRON",
      "CRON_SECRET not configured - integrity audit endpoint disabled",
    );
    return NextResponse.json(
      {
        success: false,
        error: "Cron endpoint not configured",
      },
      {
        status: 503,
      },
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const run = await startCronRun("audit-integrity");

  try {
    const now = new Date();
    const stalePayoutCutoff = new Date(now.getTime() - STALE_PAYOUT_CUTOFF_MS);
    const { db } = await getDb();

    const [orders, bookings, complaints] = await Promise.all([
      db
        .collection("orders")
        .find(
          {
            $or: [
              {
                payment_status: "refunded",
                payout_status: { $in: ["processing", "paid"] },
              },
              {
                payment_status: { $in: ["unpaid", "refunded"] },
                payout_id: { $exists: true, $ne: null },
              },
              {
                payment_status: "released",
                escrow_released_at: { $exists: false },
              },
              {
                payment_status: { $in: ["paid", "held", "released"] },
                $or: [
                  { razorpay_payment_id: { $exists: false } },
                  { razorpay_payment_id: null },
                  { razorpay_payment_id: "" },
                ],
              },
              {
                payout_status: "processing",
                $or: [
                  { payout_id: { $exists: false } },
                  { payout_id: null },
                  { payout_id: "" },
                ],
                $and: [
                  {
                    $or: [
                      { payout_lock_at: { $lt: stalePayoutCutoff } },
                      { payout_updated_at: { $lt: stalePayoutCutoff } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            projection: {
              payment_status: 1,
              payout_status: 1,
              payout_id: 1,
              payout_lock_at: 1,
              payout_updated_at: 1,
              escrow_released_at: 1,
              razorpay_payment_id: 1,
            },
          },
        )
        .toArray(),
      db
        .collection("bookings")
        .find(
          {
            $or: [
              {
                bookingFeeStatus: "applied",
                $or: [
                  { payout_id: { $exists: false } },
                  { payout_id: null },
                  { payout_id: "" },
                ],
              },
              {
                bookingFeeStatus: "refunded",
                status: { $nin: ["cancelled", "rejected"] },
              },
            ],
          },
          {
            projection: {
              status: 1,
              bookingFeeStatus: 1,
              payout_id: 1,
            },
          },
        )
        .toArray(),
      db
        .collection("complaints")
        .find(
          {
            $or: [
              {
                status: { $in: ["resolved", "rejected"] },
                $or: [{ resolvedAt: { $exists: false } }, { resolvedAt: null }],
              },
              {
                status: { $in: ["accepted", "in_review"] },
              },
              {
                status: "in_review",
                $or: [
                  { provider_access_granted: { $exists: false } },
                  { provider_access_granted: false },
                  { provider_access_granted: null },
                ],
              },
            ],
          },
          {
            projection: {
              status: 1,
              resolvedAt: 1,
              response_deadline: 1,
              provider_access_granted: 1,
            },
          },
        )
        .toArray(),
    ]);

    const anomalies = auditIntegrity({
      orders,
      bookings,
      complaints,
      now,
    });

    const alertCollection = db.collection<SystemAlertDocument>("system_alerts");
    const activeKeys = new Set(anomalies.map(anomalyId));

    let openedOrUpdated = 0;
    if (anomalies.length > 0) {
      const openOps = anomalies.map((anomaly) => ({
        updateOne: {
          filter: {
            kind: "integrity" as const,
            key: anomaly.key,
            entityType: anomaly.entityType,
            entityId: anomaly.entityId,
            status: "open" as const,
          },
          update: {
            $set: {
              severity: anomaly.severity,
              message: anomaly.message,
              lastSeenAt: now,
              updatedAt: now,
            },
            $setOnInsert: {
              kind: "integrity" as const,
              key: anomaly.key,
              entityType: anomaly.entityType,
              entityId: anomaly.entityId,
              status: "open" as const,
              firstSeenAt: now,
              createdAt: now,
            },
          },
          upsert: true,
        },
      }));

      const openResult = await alertCollection.bulkWrite(openOps, {
        ordered: false,
      });
      openedOrUpdated =
        (openResult.upsertedCount || 0) + (openResult.modifiedCount || 0);
    }

    const existingOpenAlerts = await alertCollection
      .find(
        {
          kind: "integrity",
          status: "open",
        },
        {
          projection: {
            key: 1,
            entityType: 1,
            entityId: 1,
          },
        },
      )
      .toArray();

    const resolveOps = existingOpenAlerts
      .filter((alert) => {
        const id = `${alert.key}:${alert.entityType}:${alert.entityId}`;
        return !activeKeys.has(id);
      })
      .map((alert) => ({
        updateOne: {
          filter: {
            kind: "integrity" as const,
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
      const resolveResult = await alertCollection.bulkWrite(resolveOps, {
        ordered: false,
      });
      resolvedCount = resolveResult.modifiedCount || 0;
    }

    const severitySummary = anomalies.reduce(
      (acc, anomaly) => {
        acc[anomaly.severity] += 1;
        return acc;
      },
      { critical: 0, high: 0, medium: 0 },
    );

    const result = {
      success: true,
      anomalies: anomalies.length,
      openedOrUpdated,
      resolvedCount,
      severitySummary,
      sample: anomalies.slice(0, 25),
      at: now.toISOString(),
    };

    await completeCronRun(run.insertedId, "success", result);

    logger.info("CRON", "Integrity audit completed", {
      anomalies: anomalies.length,
      openedOrUpdated,
      resolvedCount,
      severitySummary,
    });

    return NextResponse.json(
      {
        ...result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Integrity audit failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Integrity audit failed",
      },
      {
        status: 500,
      },
    );
  }
}
