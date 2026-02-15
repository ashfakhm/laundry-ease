import {
  OVERDUE_COMPLAINTS_ALERT_THRESHOLD,
  OVERDUE_HELD_ORDERS_ALERT_THRESHOLD,
  PAYOUT_FAILURE_ALERT_THRESHOLD,
} from "@/lib/constants";

export type OperationalSignalKey =
  | "overdue_held_orders"
  | "payout_failures_spike"
  | "overdue_complaints";

export type OperationalSignal = {
  key: OperationalSignalKey;
  severity: "critical" | "high";
  count: number;
  threshold: number;
  message: string;
  context: Record<string, unknown>;
};

export type OperationalMetrics = {
  actionableOverdueHeldOrders: number;
  recentPayoutFailures: number;
  overdueComplaints: number;
  heldOrderCutoffIso: string;
  heldOrderGraceMs: number;
  blockedByComplaintCount: number;
  payoutLookbackMs: number;
  payoutSinceIso: string;
};

export type OperationalThresholds = {
  overdueHeldOrders: number;
  payoutFailures: number;
  overdueComplaints: number;
};

export function defaultOperationalThresholds(): OperationalThresholds {
  return {
    overdueHeldOrders: OVERDUE_HELD_ORDERS_ALERT_THRESHOLD,
    payoutFailures: PAYOUT_FAILURE_ALERT_THRESHOLD,
    overdueComplaints: OVERDUE_COMPLAINTS_ALERT_THRESHOLD,
  };
}

export function evaluateOperationalSignals(
  metrics: OperationalMetrics,
  thresholds: OperationalThresholds = defaultOperationalThresholds(),
): OperationalSignal[] {
  const signals: OperationalSignal[] = [];

  if (metrics.actionableOverdueHeldOrders >= thresholds.overdueHeldOrders) {
    signals.push({
      key: "overdue_held_orders",
      severity: "critical",
      count: metrics.actionableOverdueHeldOrders,
      threshold: thresholds.overdueHeldOrders,
      message:
        "Held orders are overdue beyond release grace without active complaints.",
      context: {
        cutoff: metrics.heldOrderCutoffIso,
        graceMs: metrics.heldOrderGraceMs,
        blockedByComplaintCount: metrics.blockedByComplaintCount,
      },
    });
  }

  if (metrics.recentPayoutFailures >= thresholds.payoutFailures) {
    signals.push({
      key: "payout_failures_spike",
      severity: "high",
      count: metrics.recentPayoutFailures,
      threshold: thresholds.payoutFailures,
      message: "Payout failures exceeded the configured lookback threshold.",
      context: {
        lookbackMs: metrics.payoutLookbackMs,
        since: metrics.payoutSinceIso,
      },
    });
  }

  if (metrics.overdueComplaints >= thresholds.overdueComplaints) {
    signals.push({
      key: "overdue_complaints",
      severity: "high",
      count: metrics.overdueComplaints,
      threshold: thresholds.overdueComplaints,
      message:
        "Accepted/in-review complaints are overdue against response deadlines.",
      context: {},
    });
  }

  return signals;
}
