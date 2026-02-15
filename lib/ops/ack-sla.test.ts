import { describe, expect, it } from "vitest";
import { alertAgeMinutes, isAckSlaBreached } from "@/lib/ops/ack-sla";

describe("acknowledgement SLA helpers", () => {
  const now = new Date("2026-02-15T12:00:00.000Z");

  it("detects breach for critical alerts after 15 minutes when unacknowledged", () => {
    expect(
      isAckSlaBreached(
        {
          severity: "critical",
          firstSeenAt: "2026-02-15T11:40:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("does not mark acknowledged alerts as breached", () => {
    expect(
      isAckSlaBreached(
        {
          severity: "high",
          firstSeenAt: "2026-02-15T10:00:00.000Z",
          acknowledgedAt: "2026-02-15T10:10:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("calculates alert age minutes safely", () => {
    expect(alertAgeMinutes("2026-02-15T11:00:00.000Z", now)).toBe(60);
    expect(alertAgeMinutes(undefined, now)).toBe(0);
  });
});
