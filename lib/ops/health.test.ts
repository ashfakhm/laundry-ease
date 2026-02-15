import { describe, expect, it } from "vitest";
import { evaluateOperationalSignals } from "@/lib/ops/health";

const baseMetrics = {
  actionableOverdueHeldOrders: 0,
  recentPayoutFailures: 0,
  overdueComplaints: 0,
  heldOrderCutoffIso: "2026-02-15T00:00:00.000Z",
  heldOrderGraceMs: 60 * 60 * 1000,
  blockedByComplaintCount: 0,
  payoutLookbackMs: 24 * 60 * 60 * 1000,
  payoutSinceIso: "2026-02-14T00:00:00.000Z",
};

describe("evaluateOperationalSignals", () => {
  it("returns no signals when metrics are below thresholds", () => {
    const signals = evaluateOperationalSignals(baseMetrics, {
      overdueHeldOrders: 3,
      payoutFailures: 3,
      overdueComplaints: 2,
    });

    expect(signals).toEqual([]);
  });

  it("returns all configured signals when all thresholds are reached", () => {
    const signals = evaluateOperationalSignals(
      {
        ...baseMetrics,
        actionableOverdueHeldOrders: 4,
        recentPayoutFailures: 5,
        overdueComplaints: 2,
      },
      {
        overdueHeldOrders: 3,
        payoutFailures: 3,
        overdueComplaints: 2,
      },
    );

    expect(signals.map((signal) => signal.key)).toEqual([
      "overdue_held_orders",
      "payout_failures_spike",
      "overdue_complaints",
    ]);
    expect(signals[0]).toEqual(
      expect.objectContaining({
        severity: "critical",
        count: 4,
        threshold: 3,
      }),
    );
  });

  it("includes contextual metadata for held and payout alerts", () => {
    const signals = evaluateOperationalSignals(
      {
        ...baseMetrics,
        actionableOverdueHeldOrders: 3,
        recentPayoutFailures: 3,
      },
      {
        overdueHeldOrders: 3,
        payoutFailures: 3,
        overdueComplaints: 99,
      },
    );

    const held = signals.find((signal) => signal.key === "overdue_held_orders");
    const payout = signals.find(
      (signal) => signal.key === "payout_failures_spike",
    );

    expect(held?.context).toEqual(
      expect.objectContaining({
        cutoff: baseMetrics.heldOrderCutoffIso,
        graceMs: baseMetrics.heldOrderGraceMs,
      }),
    );
    expect(payout?.context).toEqual(
      expect.objectContaining({
        lookbackMs: baseMetrics.payoutLookbackMs,
        since: baseMetrics.payoutSinceIso,
      }),
    );
  });
});
