import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { startCronRun, completeCronRun } from "@/lib/cron-tracking";
import { buildAlertDeliveryPlan } from "@/lib/ops/alert-delivery";
import {
  deliverAlertDigest,
  type AlertDigestItem,
  type AlertDeliveryResult,
} from "@/lib/ops/alert-channels";
import type { ObjectId } from "mongodb";

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
};

function toIso(value?: Date): string {
  return value ? value.toISOString() : "";
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

// GET /api/cron/notify-system-alerts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error("CRON", "CRON_SECRET not configured - notify alerts disabled");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
          },
        },
      )
      .toArray();

    const plan = buildAlertDeliveryPlan(
      alerts.map((alert) => ({
        _id: alert._id.toString(),
        key: alert.key,
        message: alert.message,
        severity: alert.severity,
        status: alert.status,
        firstSeenAt: alert.firstSeenAt,
        lastSeenAt: alert.lastSeenAt,
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

    let notifyDelivery: AlertDeliveryResult = {
      emailSent: false,
      webhookSent: false,
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
      success: true,
      at: now.toISOString(),
      openAlerts: alerts.length,
      due: {
        notify: notifyItems.length,
        escalate: escalateItems.length,
      },
      delivered: {
        notify: notifyDelivery,
        escalate: escalateDelivery,
      },
    };

    await completeCronRun(run.insertedId, "success", result);
    logger.info("CRON", "System alert notifications completed", result);
    return NextResponse.json(result);
  } catch (error) {
    await completeCronRun(run.insertedId, "error", undefined, error);
    logger.error("CRON", "System alert notifications failed", error);
    return NextResponse.json(
      { error: "System alert notification failed" },
      { status: 500 },
    );
  }
}
