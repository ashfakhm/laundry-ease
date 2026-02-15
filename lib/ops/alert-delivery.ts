import {
  ALERT_ESCALATION_REPEAT_MS,
  ALERT_NOTIFICATION_DEDUPE_MS,
  CRITICAL_ALERT_ESCALATION_MS,
  HIGH_ALERT_ESCALATION_MS,
} from "@/lib/constants";

type DateLike = Date | string | undefined | null;

export type AlertSeverity = "critical" | "high" | "medium";

export type SystemAlertInput = {
  _id: string;
  key: string;
  message: string;
  severity: AlertSeverity;
  status: "open" | "resolved";
  firstSeenAt?: DateLike;
  lastSeenAt?: DateLike;
  notification?: {
    lastNotifiedAt?: DateLike;
    lastEscalatedAt?: DateLike;
  };
};

export type DeliveryConfig = {
  dedupeMs: number;
  escalationRepeatMs: number;
  criticalEscalationMs: number;
  highEscalationMs: number;
};

export type DeliveryPlan = {
  notifyIds: string[];
  escalateIds: string[];
};

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function elapsedMs(from: DateLike, now: Date): number {
  const date = toDate(from);
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, now.getTime() - date.getTime());
}

export function defaultDeliveryConfig(): DeliveryConfig {
  return {
    dedupeMs: ALERT_NOTIFICATION_DEDUPE_MS,
    escalationRepeatMs: ALERT_ESCALATION_REPEAT_MS,
    criticalEscalationMs: CRITICAL_ALERT_ESCALATION_MS,
    highEscalationMs: HIGH_ALERT_ESCALATION_MS,
  };
}

function isEscalationDue(
  alert: SystemAlertInput,
  now: Date,
  config: DeliveryConfig,
): boolean {
  const ageMs = elapsedMs(alert.firstSeenAt, now);
  const lastEscalatedAgoMs = elapsedMs(
    alert.notification?.lastEscalatedAt,
    now,
  );

  if (lastEscalatedAgoMs < config.escalationRepeatMs) {
    return false;
  }

  if (alert.severity === "critical") {
    return ageMs >= config.criticalEscalationMs;
  }
  if (alert.severity === "high") {
    return ageMs >= config.highEscalationMs;
  }
  return false;
}

export function buildAlertDeliveryPlan(
  alerts: SystemAlertInput[],
  now = new Date(),
  config = defaultDeliveryConfig(),
): DeliveryPlan {
  const notifyIds: string[] = [];
  const escalateIds: string[] = [];

  for (const alert of alerts) {
    if (alert.status !== "open") continue;
    if (alert.severity !== "critical" && alert.severity !== "high") continue;

    const lastNotifiedAgoMs = elapsedMs(alert.notification?.lastNotifiedAt, now);
    if (lastNotifiedAgoMs >= config.dedupeMs) {
      notifyIds.push(alert._id);
    }

    if (isEscalationDue(alert, now, config)) {
      escalateIds.push(alert._id);
    }
  }

  return { notifyIds, escalateIds };
}
