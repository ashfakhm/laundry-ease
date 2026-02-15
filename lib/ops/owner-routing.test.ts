import { describe, expect, it } from "vitest";
import { buildOwnerRoutingDecisions } from "@/lib/ops/owner-routing";

describe("buildOwnerRoutingDecisions", () => {
  const now = new Date("2026-02-15T12:00:00.000Z");

  it("routes unassigned breached critical/high alerts to default owners", () => {
    const decisions = buildOwnerRoutingDecisions(
      [
        {
          _id: "critical-a",
          severity: "critical",
          firstSeenAt: "2026-02-15T11:40:00.000Z",
        },
        {
          _id: "high-a",
          severity: "high",
          firstSeenAt: "2026-02-15T10:30:00.000Z",
        },
      ],
      now,
    );

    expect(decisions).toEqual([
      {
        id: "critical-a",
        nextOwner: "backend_oncall",
        reason: "sla_breach_initial_route",
      },
      {
        id: "high-a",
        nextOwner: "platform_admin_oncall",
        reason: "sla_breach_initial_route",
      },
    ]);
  });

  it("routes persistent breached alerts to tech lead", () => {
    const decisions = buildOwnerRoutingDecisions(
      [
        {
          _id: "critical-persist",
          severity: "critical",
          firstSeenAt: "2026-02-15T10:00:00.000Z",
          owner: "backend_oncall",
        },
        {
          _id: "high-persist",
          severity: "high",
          firstSeenAt: "2026-02-15T07:00:00.000Z",
          owner: "platform_admin_oncall",
        },
      ],
      now,
    );

    expect(decisions).toEqual([
      {
        id: "critical-persist",
        nextOwner: "tech_lead",
        reason: "sla_breach_persistent_route",
      },
      {
        id: "high-persist",
        nextOwner: "tech_lead",
        reason: "sla_breach_persistent_route",
      },
    ]);
  });

  it("skips acknowledged, non-breached, or already-tech-lead alerts", () => {
    const decisions = buildOwnerRoutingDecisions(
      [
        {
          _id: "ack",
          severity: "critical",
          firstSeenAt: "2026-02-15T09:00:00.000Z",
          acknowledgedAt: "2026-02-15T09:10:00.000Z",
        },
        {
          _id: "not-breached",
          severity: "critical",
          firstSeenAt: "2026-02-15T11:55:00.000Z",
        },
        {
          _id: "already-lead",
          severity: "high",
          firstSeenAt: "2026-02-15T07:00:00.000Z",
          owner: "tech_lead",
        },
      ],
      now,
    );

    expect(decisions).toEqual([]);
  });
});
