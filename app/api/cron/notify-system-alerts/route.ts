import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { buildAlertDeliveryPlan } from "@/lib/ops/alert-delivery";
import { buildOwnerRoutingDecisions } from "@/lib/ops/owner-routing";
import {
  deliverAlertDigest,
  type AlertDigestItem,
  type AlertDeliveryResult,
} from "@/lib/ops/alert-channels";
import type { ObjectId } from "mongodb";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireCronSecret } from "@/lib/api/cron-auth";

type SystemAlertDocument = {
  _id: ObjectId;
  kind: string;
  key: string;
  message: string;
  severity: "critical" | "high" | "medium";
  status: "open" | "resolved";
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  notification?: {
    lastNotifiedAt?: Date;
    notifyCount?: number;
    lastEscalatedAt?: Date;
    escalatedCount?: number;
  };
  ownership?: {
    acknowledgedAt?: Date;
    owner?: "platform_admin_oncall" | "backend_oncall" | "tech_lead";
    lastRoutedAt?: Date;
  };
};

function toIso(value?: Date): string {
  return value ? value.toISOString() : "";
}

function ownerLabel(
  owner: "platform_admin_oncall" | "backend_oncall" | "tech_lead",
): string {
  if (owner === "platform_admin_oncall") return "Platform Admin On-Call";
  if (owner === "backend_oncall") return "Backend On-Call";
  return "Tech Lead";
}

function toDigestItem(alert: SystemAlertDocument): AlertDigestItem {
  return {
    id: alert._id.toString(),
    severity: alert.severity === "critical" ? "critical" : "high",
    key: alert.key,
    message: alert.message,
    firstSeenAt: toIso(alert.firstSeenAt),
    lastSeenAt: toIso(alert.lastSeenAt),
  };
}

export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);
  } catch (error) {
    return errorResponse(error);
  }

  const run = await startCronRun("notify-system-alerts");

  try {
    const now = new Date();
    const { db } = await getDb();
    const alerts = await db
      .collection<SystemAlertDocument>("system_alerts")
      .find(
        {
          status: "open",
          severity: { $in: ["critical", "high"] },
        },
        {
          projection: {
            kind: 1,
            key: 1,
            message: 1,
            severity: 1,
            status: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            notification: 1,
            "ownership.acknowledgedAt": 1,
            "ownership.owner": 1,
            "ownership.lastRoutedAt": 1,
          },
        },
      )
      .toArray();

    const routingDecisions = buildOwnerRoutingDecisions(
      alerts.map((alert) => ({
        _id: alert._id.toString(),
        severity: alert.severity === "critical" ? "critical" : "high",
        firstSeenAt: alert.firstSeenAt,
        acknowledgedAt: alert.ownership?.acknowledgedAt,
        owner: alert.ownership?.owner || null,
      })),
      now,
    );

    if (routingDecisions.length > 0) {
      await db.collection("system_alerts").bulkWrite(
        routingDecisions.map((decision) => ({
          updateOne: {
            filter: {
              _id: alerts.find((alert) => alert._id.toString() === decision.id)
                ?._id,
              status: "open",
              $or: [
                { "ownership.acknowledgedAt": { $exists: false } },
                { "ownership.acknowledgedAt": null },
              ],
            },
            update: {
              $set: {
                "ownership.owner": decision.nextOwner,
                "ownership.lastRoutedAt": now,
                "ownership.routeReason": decision.reason,
                updatedAt: now,
              },
              $inc: {
                "ownership.routeCount": 1,
              },
            },
          },
        })),
        { ordered: false },
      );
    }

    const plan = buildAlertDeliveryPlan(
      alerts.map((alert) => ({
        _id: alert._id.toString(),
        key: alert.key,
        message: alert.message,
        severity: alert.severity,
        status: alert.status,
        firstSeenAt: alert.firstSeenAt,
        lastSeenAt: alert.lastSeenAt,
        acknowledgedAt: alert.ownership?.acknowledgedAt,
        notification: alert.notification,
      })),
      now,
    );

    const openCritical = alerts.filter(
      (alert) => alert.severity === "critical",
    ).length;
    const openHigh = alerts.filter((alert) => alert.severity === "high").length;

    const notifySet = new Set(plan.notifyIds);
    const escalateSet = new Set(plan.escalateIds);

    const notifyItems = alerts
      .filter((alert) => notifySet.has(alert._id.toString()))
      .map(toDigestItem);
    const escalateItems = alerts
      .filter((alert) => escalateSet.has(alert._id.toString()))
      .map(toDigestItem);
    const routingDecisionMap = new Map(
      routingDecisions.map((decision) => [decision.id, decision]),
    );
    const routingItems = alerts
      .filter((alert) => routingDecisionMap.has(alert._id.toString()))
      .map((alert) => {
        const decision = routingDecisionMap.get(alert._id.toString())!;
        return {
          ...toDigestItem(alert),
          message: `[Owner Routed -> ${ownerLabel(decision.nextOwner)}] ${alert.message}`,
        };
      });

    let notifyDelivery: AlertDeliveryResult = {
      emailSent: false,
      webhookSent: false,
      pagerDutySent: false,
      skipped: true,
      reason: "No notifications due",
    };
    if (notifyItems.length > 0) {
      notifyDelivery = await deliverAlertDigest({
        kind: "notify",
        generatedAt: now.toISOString(),
        totalOpen: alerts.length,
        criticalOpen: openCritical,
        highOpen: openHigh,
        items: notifyItems,
      });
    }

    let escalateDelivery: AlertDeliveryResult = {
      emailSent: false,
      webhookSent: false,
      pagerDutySent: false,
      skipped: true,
      reason: "No escalations due",
    };
    if (escalateItems.length > 0) {
      escalateDelivery = await deliverAlertDigest({
        kind: "escalate",
        generatedAt: now.toISOString(),
        totalOpen: alerts.length,
        criticalOpen: openCritical,
        highOpen: openHigh,
        items: escalateItems,
      });
    }

    let routingDelivery: AlertDeliveryResult = {
      emailSent: false,
      webhookSent: false,
      pagerDutySent: false,
      skipped: true,
      reason: "No ownership routing updates",
    };
    if (routingItems.length > 0) {
      routingDelivery = await deliverAlertDigest({
        kind: "escalate",
        generatedAt: now.toISOString(),
        totalOpen: alerts.length,
        criticalOpen: openCritical,
        highOpen: openHigh,
        items: routingItems,
      });
    }

    const notifyObjectIds = alerts
      .filter((alert) => notifySet.has(alert._id.toString()))
      .map((alert) => alert._id);
    const escalateObjectIds = alerts
      .filter((alert) => escalateSet.has(alert._id.toString()))
      .map((alert) => alert._id);

    if (!notifyDelivery.skipped && notifyObjectIds.length > 0) {
      await db.collection("system_alerts").updateMany(
        { _id: { $in: notifyObjectIds } },
        {
          $set: {
            "notification.lastNotifiedAt": now,
            updatedAt: now,
          },
          $inc: {
            "notification.notifyCount": 1,
          },
        },
      );
    }

    if (!escalateDelivery.skipped && escalateObjectIds.length > 0) {
      await db.collection("system_alerts").updateMany(
        { _id: { $in: escalateObjectIds } },
        {
          $set: {
            "notification.lastEscalatedAt": now,
            updatedAt: now,
          },
          $inc: {
            "notification.escalatedCount": 1,
          },
        },
      );
    }

    const result = {
      at: now.toISOString(),
      openAlerts: alerts.length,
      due: {
        notify: notifyItems.length,
        escalate: escalateItems.length,
        routed: routingItems.length,
      },
      delivered: {
        notify: notifyDelivery,
        escalate: escalateDelivery,
        routed: routingDelivery,
      },
      ownershipRouting: {
        decisions: routingDecisions.length,
      },
    };

    await completeCronRun(run.insertedId, "success", result);
    logger.info("CRON", "System alert notifications completed", result);
    return successResponse(result);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "System alert notifications failed", error);
    return errorResponse(error);
  }
}
