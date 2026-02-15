import {
  CRITICAL_ALERT_PERSISTENT_ROUTE_MS,
  HIGH_ALERT_PERSISTENT_ROUTE_MS,
} from "@/lib/constants";
import { isAckSlaBreached } from "@/lib/ops/ack-sla";

type DateLike = Date | string | undefined | null;

export type AlertOwner = "platform_admin_oncall" | "backend_oncall" | "tech_lead";

export type OwnerRoutingInput = {
  _id: string;
  severity: "critical" | "high";
  firstSeenAt?: DateLike;
  acknowledgedAt?: DateLike;
  owner?: AlertOwner | null;
};

export type OwnerRoutingDecision = {
  id: string;
  nextOwner: AlertOwner;
  reason: "sla_breach_initial_route" | "sla_breach_persistent_route";
};

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageMs(firstSeenAt: DateLike, now: Date): number {
  const firstSeen = toDate(firstSeenAt);
  if (!firstSeen) return 0;
  return Math.max(0, now.getTime() - firstSeen.getTime());
}

function initialOwner(severity: "critical" | "high"): AlertOwner {
  return severity === "critical" ? "backend_oncall" : "platform_admin_oncall";
}

function persistentThresholdMs(severity: "critical" | "high"): number {
  return severity === "critical"
    ? CRITICAL_ALERT_PERSISTENT_ROUTE_MS
    : HIGH_ALERT_PERSISTENT_ROUTE_MS;
}

export function buildOwnerRoutingDecisions(
  alerts: OwnerRoutingInput[],
  now = new Date(),
): OwnerRoutingDecision[] {
  const decisions: OwnerRoutingDecision[] = [];
  const ownerLoad = new Map<AlertOwner, number>([
    ["platform_admin_oncall", 0],
    ["backend_oncall", 0],
    ["tech_lead", 0],
  ]);

  for (const alert of alerts) {
    if (alert.owner) {
      ownerLoad.set(alert.owner, (ownerLoad.get(alert.owner) || 0) + 1);
    }
  }

  for (const alert of alerts) {
    const breached = isAckSlaBreached(
      {
        severity: alert.severity,
        firstSeenAt: alert.firstSeenAt,
        acknowledgedAt: alert.acknowledgedAt,
      },
      now,
    );
    if (!breached) continue;

    if (!alert.owner) {
      const nextOwner =
        alert.severity === "critical"
          ? initialOwner(alert.severity)
          : (ownerLoad.get("platform_admin_oncall") || 0) <=
              (ownerLoad.get("backend_oncall") || 0)
            ? "platform_admin_oncall"
            : "backend_oncall";

      ownerLoad.set(nextOwner, (ownerLoad.get(nextOwner) || 0) + 1);
      decisions.push({
        id: alert._id,
        nextOwner,
        reason: "sla_breach_initial_route",
      });
      continue;
    }

    if (
      alert.owner !== "tech_lead" &&
      ageMs(alert.firstSeenAt, now) >= persistentThresholdMs(alert.severity)
    ) {
      decisions.push({
        id: alert._id,
        nextOwner: "tech_lead",
        reason: "sla_breach_persistent_route",
      });
    }
  }

  return decisions;
}
