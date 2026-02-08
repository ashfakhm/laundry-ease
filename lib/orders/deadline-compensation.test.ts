import { describe, expect, it } from "vitest";
import { evaluateDeadlineCompensation } from "./deadline-compensation";

describe("evaluateDeadlineCompensation", () => {
  const now = new Date("2026-02-08T12:00:00.000Z");

  it("returns no compensation when deadline is not breached", () => {
    const decision = evaluateDeadlineCompensation({
      now,
      deadline: new Date("2026-02-08T13:00:00.000Z"),
      paymentStatus: "paid",
      alreadyCompensated: false,
      paidAmount: 500,
    });

    expect(decision).toEqual({
      deadlineBreached: false,
      shouldRefund: false,
      blocked: false,
    });
  });

  it("returns refund when breached, paid, and not compensated", () => {
    const decision = evaluateDeadlineCompensation({
      now,
      deadline: new Date("2026-02-08T10:00:00.000Z"),
      paymentStatus: "paid",
      alreadyCompensated: false,
      paidAmount: 500,
    });

    expect(decision).toEqual({
      deadlineBreached: true,
      shouldRefund: true,
      blocked: false,
    });
  });

  it("blocks when breached but payment state is non-refundable", () => {
    const decision = evaluateDeadlineCompensation({
      now,
      deadline: new Date("2026-02-08T10:00:00.000Z"),
      paymentStatus: "held",
      alreadyCompensated: false,
      paidAmount: 500,
    });

    expect(decision).toMatchObject({
      deadlineBreached: true,
      shouldRefund: false,
      blocked: true,
    });
    expect(typeof decision.blockedMessage).toBe("string");
  });

  it("skips compensation when already compensated", () => {
    const decision = evaluateDeadlineCompensation({
      now,
      deadline: new Date("2026-02-08T10:00:00.000Z"),
      paymentStatus: "paid",
      alreadyCompensated: true,
      paidAmount: 500,
    });

    expect(decision).toEqual({
      deadlineBreached: true,
      shouldRefund: false,
      blocked: false,
    });
  });

  it("skips refund logic when paid amount is zero", () => {
    const decision = evaluateDeadlineCompensation({
      now,
      deadline: new Date("2026-02-08T10:00:00.000Z"),
      paymentStatus: "paid",
      alreadyCompensated: false,
      paidAmount: 0,
    });

    expect(decision).toEqual({
      deadlineBreached: true,
      shouldRefund: false,
      blocked: false,
    });
  });
});
