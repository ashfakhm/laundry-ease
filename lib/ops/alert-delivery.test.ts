import { describe, expect, it } from "vitest";
import {
  buildAlertDeliveryPlan,
  defaultDeliveryConfig,
} from "@/lib/ops/alert-delivery";

describe("buildAlertDeliveryPlan", () => {
  const now = new Date("2026-02-15T12:00:00.000Z");
  const config = defaultDeliveryConfig();

  it("notifies new critical/high alerts immediately", () => {
    const plan = buildAlertDeliveryPlan(
      [
        {
          _id: "a1",
          key: "x",
          message: "m",
          severity: "critical",
          status: "open",
          firstSeenAt: "2026-02-15T11:50:00.000Z",
        },
        {
          _id: "a2",
          key: "y",
          message: "m",
          severity: "high",
          status: "open",
          firstSeenAt: "2026-02-15T11:40:00.000Z",
        },
      ],
      now,
      config,
    );

    expect(plan.notifyIds).toEqual(["a1", "a2"]);
  });

  it("respects dedupe window for repeated notifications", () => {
    const plan = buildAlertDeliveryPlan(
      [
        {
          _id: "a1",
          key: "x",
          message: "m",
          severity: "critical",
          status: "open",
          firstSeenAt: "2026-02-15T10:00:00.000Z",
          notification: {
            lastNotifiedAt: "2026-02-15T11:30:00.000Z",
          },
        },
      ],
      now,
      config,
    );

    expect(plan.notifyIds).toEqual([]);
  });

  it("escalates critical/high alerts only after thresholds and repeat spacing", () => {
    const plan = buildAlertDeliveryPlan(
      [
        {
          _id: "critical_due",
          key: "c",
          message: "m",
          severity: "critical",
          status: "open",
          firstSeenAt: "2026-02-15T10:30:00.000Z",
        },
        {
          _id: "high_due",
          key: "h",
          message: "m",
          severity: "high",
          status: "open",
          firstSeenAt: "2026-02-15T09:30:00.000Z",
        },
        {
          _id: "critical_repeat_blocked",
          key: "cb",
          message: "m",
          severity: "critical",
          status: "open",
          firstSeenAt: "2026-02-15T09:00:00.000Z",
          notification: {
            lastEscalatedAt: "2026-02-15T11:00:00.000Z",
          },
        },
        {
          _id: "medium_never",
          key: "m",
          message: "m",
          severity: "medium",
          status: "open",
          firstSeenAt: "2026-02-15T08:00:00.000Z",
        },
      ],
      now,
      config,
    );

    expect(plan.escalateIds).toEqual(["critical_due", "high_due"]);
  });

  it("skips notify/escalation for acknowledged alerts", () => {
    const plan = buildAlertDeliveryPlan(
      [
        {
          _id: "acknowledged",
          key: "a",
          message: "m",
          severity: "critical",
          status: "open",
          firstSeenAt: "2026-02-15T09:00:00.000Z",
          acknowledgedAt: "2026-02-15T09:10:00.000Z",
        },
      ],
      now,
      config,
    );

    expect(plan.notifyIds).toEqual([]);
    expect(plan.escalateIds).toEqual([]);
  });
});
