import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import {
  HELD_ORDER_ALERT_GRACE_MS,
  PAYOUT_FAILURE_ALERT_LOOKBACK_MS,
} from "@/lib/constants";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import {
  defaultOperationalThresholds,
  evaluateOperationalSignals,
  type OperationalSignal,
} from "@/lib/ops/health";
import { ObjectId } from "mongodb";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireCronSecret } from "@/lib/api/cron-auth";
import { syncAlerts } from "@/lib/ops/alert-lifecycle";

const ACTIVE_COMPLAINT_STATUSES = ["open", "accepted", "in_review"] as const;

function toObjectId(value: unknown): ObjectId | null {
  if (typeof value === "string" && value.length > 0) {
    return ObjectId.isValid(value) ? new ObjectId(value) : null;
  }
  if (value && typeof value === "object" && "_bsontype" in value) {
    return value as ObjectId;
  }
  return null;
}

// GET /api/cron/monitor-operational-health
export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);
  } catch (error) {
    return errorResponse(error);
  }

  const run = await startCronRun("monitor-operational-health");

  try {
    const now = new Date();
    const heldOrderCutoff = new Date(now.getTime() - HELD_ORDER_ALERT_GRACE_MS);
    const payoutFailureSince = new Date(
      now.getTime() - PAYOUT_FAILURE_ALERT_LOOKBACK_MS,
    );
    const thresholds = defaultOperationalThresholds();
    const { db } = await getDb();

    const overdueHeldOrders = await db
      .collection("orders")
      .find(
        {
          payment_status: "held",
          escrow_release_at: { $lt: heldOrderCutoff },
        },
        { projection: { _id: 1 } },
      )
      .toArray();

    const overdueOrderIds = overdueHeldOrders
      .map((order) => toObjectId(order._id))
      .filter((id): id is ObjectId => Boolean(id));

    const blockedByComplaintCount =
      overdueOrderIds.length > 0
        ? await db.collection("complaints").countDocuments({
            order_id: { $in: overdueOrderIds },
            status: { $in: [...ACTIVE_COMPLAINT_STATUSES] },
          })
        : 0;

    const actionableOverdueHeldOrders = Math.max(
      0,
      overdueHeldOrders.length - blockedByComplaintCount,
    );

    const [recentPayoutFailures, overdueComplaints] = await Promise.all([
      db.collection("orders").countDocuments({
        payout_status: "failed",
        payout_failure_at: { $gte: payoutFailureSince },
      }),
      db.collection("complaints").countDocuments({
        status: { $in: ["accepted", "in_review"] },
        response_deadline: { $lt: now },
      }),
    ]);

    const signals: OperationalSignal[] = evaluateOperationalSignals(
      {
        actionableOverdueHeldOrders,
        recentPayoutFailures,
        overdueComplaints,
        heldOrderCutoffIso: heldOrderCutoff.toISOString(),
        heldOrderGraceMs: HELD_ORDER_ALERT_GRACE_MS,
        blockedByComplaintCount,
        payoutLookbackMs: PAYOUT_FAILURE_ALERT_LOOKBACK_MS,
        payoutSinceIso: payoutFailureSince.toISOString(),
      },
      thresholds,
    );

    const alertCollection = db.collection("system_alerts");

    const alertInputs = signals.map((signal) => ({
      key: signal.key,
      entityType: "system",
      entityId: "global",
      severity: signal.severity,
      message: signal.message,
      context: {
        ...signal.context,
        count: signal.count,
        threshold: signal.threshold,
      },
    }));

    const { openedOrUpdated, resolvedCount } = await syncAlerts(
      alertCollection,
      "operational",
      alertInputs,
      now,
    );

    const result = {
      monitoredAt: now.toISOString(),
      metrics: {
        actionableOverdueHeldOrders,
        blockedByComplaintCount,
        recentPayoutFailures,
        overdueComplaints,
      },
      thresholds: {
        overdueHeldOrders: thresholds.overdueHeldOrders,
        payoutFailures: thresholds.payoutFailures,
        overdueComplaints: thresholds.overdueComplaints,
      },
      activeSignals: signals.map((signal) => ({
        key: signal.key,
        severity: signal.severity,
        count: signal.count,
        threshold: signal.threshold,
      })),
      openedOrUpdated,
      resolvedCount,
    };

    await completeCronRun(run.insertedId, "success", result);

    logger.info("CRON", "Operational health monitor completed", {
      activeSignals: signals.length,
      openedOrUpdated,
      resolvedCount,
      metrics: result.metrics,
    });

    return successResponse(result);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "Operational health monitor failed", error);
    return errorResponse(error);
  }
}
