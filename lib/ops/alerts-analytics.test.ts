import { describe, expect, it } from "vitest";
import { buildAlertAnalytics } from "@/lib/ops/alerts-analytics";

describe("buildAlertAnalytics", () => {
  const now = new Date("2026-02-15T12:00:00.000Z");

  it("returns a 7-day trend with stable burn when no alerts exist", () => {
    const analytics = buildAlertAnalytics([], now);

    expect(analytics.trend7d).toHaveLength(7);
    expect(analytics.openedLast24h).toBe(0);
    expect(analytics.burnRate).toBe(0);
    expect(analytics.burnRateTier).toBe("stable");
    expect(analytics.mttrHours7d).toBeNull();
  });

  it("computes burn-rate tier using last 24h vs baseline daily average", () => {
    const alerts = [
      { createdAt: "2026-02-15T10:00:00.000Z" },
      { createdAt: "2026-02-15T11:00:00.000Z" },
      { createdAt: "2026-02-14T11:00:00.000Z" },
      { createdAt: "2026-02-13T11:00:00.000Z" },
      { createdAt: "2026-02-12T11:00:00.000Z" },
      { createdAt: "2026-02-11T11:00:00.000Z" },
      { createdAt: "2026-02-10T11:00:00.000Z" },
      { createdAt: "2026-02-09T11:00:00.000Z" },
      { createdAt: "2026-02-08T11:00:00.000Z" },
    ];

    const analytics = buildAlertAnalytics(alerts, now);

    expect(analytics.openedLast24h).toBe(2);
    expect(analytics.openedBaseline7d).toBe(7);
    expect(analytics.baselineOpenedDailyAvg).toBe(1);
    expect(analytics.burnRate).toBe(2);
    expect(analytics.burnRateTier).toBe("high");
  });

  it("computes MTTR from resolved alerts in the 7-day trend window", () => {
    const alerts = [
      {
        createdAt: "2026-02-14T08:00:00.000Z",
        resolvedAt: "2026-02-14T14:00:00.000Z",
      },
      {
        createdAt: "2026-02-13T09:00:00.000Z",
        resolvedAt: "2026-02-13T18:00:00.000Z",
      },
      {
        createdAt: "2026-02-01T09:00:00.000Z",
        resolvedAt: "2026-02-02T18:00:00.000Z",
      },
    ];

    const analytics = buildAlertAnalytics(alerts, now);

    expect(analytics.resolvedCount7d).toBe(2);
    expect(analytics.mttrHours7d).toBe(7.5);
    expect(
      analytics.trend7d.some((point) => point.opened > 0 || point.resolved > 0),
    ).toBe(true);
  });
});
