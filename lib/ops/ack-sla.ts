import {
  CRITICAL_ALERT_ACK_SLA_MS,
  HIGH_ALERT_ACK_SLA_MS,
} from "@/lib/constants";

type DateLike = Date | string | undefined | null;

export type AckSlaAlert = {
  severity: "critical" | "high";
  firstSeenAt?: DateLike;
  acknowledgedAt?: DateLike;
};

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function alertAgeMinutes(firstSeenAt: DateLike, now = new Date()): number {
  const firstSeen = toDate(firstSeenAt);
  if (!firstSeen) return 0;
  return Math.max(
    0,
    Math.floor((now.getTime() - firstSeen.getTime()) / (60 * 1000)),
  );
}

export function isAckSlaBreached(alert: AckSlaAlert, now = new Date()): boolean {
  if (toDate(alert.acknowledgedAt)) return false;
  const firstSeen = toDate(alert.firstSeenAt);
  if (!firstSeen) return false;

  const ageMs = now.getTime() - firstSeen.getTime();
  if (alert.severity === "critical") {
    return ageMs >= CRITICAL_ALERT_ACK_SLA_MS;
  }
  return ageMs >= HIGH_ALERT_ACK_SLA_MS;
}
