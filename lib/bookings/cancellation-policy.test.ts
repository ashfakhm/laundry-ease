import { describe, expect, it } from "vitest";
import { evaluateCancellationPolicy } from "./cancellation-policy";

describe("evaluateCancellationPolicy", () => {
  const localDate = (year: number, month: number, day: number, hour = 0) =>
    new Date(year, month - 1, day, hour, 0, 0, 0);

  it("blocks seeker cancellation at or after pickup slot time", () => {
    const now = localDate(2026, 2, 8, 10);
    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      pickupSlotTime: localDate(2026, 2, 8, 10),
      now,
    });

    expect(decision).toMatchObject({
      allowed: false,
      refundAction: "none",
    });
  });

  it("blocks cancellation when booking fee is already applied", () => {
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "applied",
      pickupSlotTime: null,
      now: localDate(2026, 2, 8, 10),
    });

    expect(decision).toMatchObject({
      allowed: false,
      refundAction: "none",
    });
  });

  it("marks same-day seeker cancellation as forfeited", () => {
    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      pickupSlotTime: localDate(2026, 2, 8, 20),
      now: localDate(2026, 2, 8, 10),
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "forfeit",
      seekerSameDayCancellation: true,
    });
  });

  it("refunds seeker cancellation before pickup day", () => {
    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      pickupSlotTime: localDate(2026, 2, 9, 9),
      now: localDate(2026, 2, 8, 10),
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "refund",
      seekerSameDayCancellation: false,
    });
  });

  it("refunds provider cancellation when fee is paid", () => {
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "paid",
      pickupSlotTime: localDate(2026, 2, 8, 9),
      now: localDate(2026, 2, 8, 10),
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "refund",
    });
  });

  it("keeps refund action none when fee is unpaid", () => {
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "pending",
      pickupSlotTime: null,
      now: localDate(2026, 2, 8, 10),
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "none",
    });
  });
});
