import { describe, expect, it } from "vitest";
import { evaluateCancellationPolicy } from "./cancellation-policy";

describe("evaluateCancellationPolicy", () => {
  const localDate = (year: number, month: number, day: number, hour = 0) =>
    new Date(year, month - 1, day, hour, 0, 0, 0);

  // ─── Seeker: blocked after pickup slot ────────────────────────────────────

  it("blocks seeker cancellation at or after pickup slot time", () => {
    const now = localDate(2026, 2, 8, 10);
    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      bookingCreatedAt: localDate(2026, 2, 8, 8), // 2 h before now
      pickupSlotTime: localDate(2026, 2, 8, 10),
      now,
    });

    expect(decision).toMatchObject({
      allowed: false,
      refundAction: "none",
    });
  });

  // ─── Applied fee blocks everyone ─────────────────────────────────────────

  it("blocks cancellation when booking fee is already applied", () => {
    const now = localDate(2026, 2, 8, 10);
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "applied",
      bookingCreatedAt: localDate(2026, 2, 8, 9),
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: false,
      refundAction: "none",
    });
  });

  // ─── Seeker: within 2-hour free-cancel window → refund ───────────────────

  it("refunds seeker who cancels within 2 hours of booking creation", () => {
    const createdAt = localDate(2026, 2, 8, 10); // created at 10:00
    const now = new Date(createdAt.getTime() + 90 * 60 * 1000); // 90 min later = 11:30
    const pickup = localDate(2026, 2, 9, 9); // tomorrow

    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      bookingCreatedAt: createdAt,
      pickupSlotTime: pickup,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "refund",
      withinFreeCancelWindow: true,
    });
  });

  it("refunds seeker who cancels exactly at the 2-hour boundary", () => {
    const createdAt = localDate(2026, 2, 8, 10);
    const now = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000); // exactly 2 h later

    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      bookingCreatedAt: createdAt,
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "refund",
      withinFreeCancelWindow: true,
    });
  });

  // ─── Seeker: outside 2-hour window → forfeit ─────────────────────────────

  it("forfeits booking fee when seeker cancels after 2-hour window", () => {
    const createdAt = localDate(2026, 2, 8, 8); // created at 08:00
    const now = localDate(2026, 2, 8, 12); // 4 hours later
    const pickup = localDate(2026, 2, 9, 9); // tomorrow

    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      bookingCreatedAt: createdAt,
      pickupSlotTime: pickup,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "forfeit",
      withinFreeCancelWindow: false,
    });
  });

  it("forfeits fee when seeker cancels 2 hours and 1 ms after creation", () => {
    const createdAt = localDate(2026, 2, 8, 10);
    const now = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000 + 1); // 1 ms over

    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "paid",
      bookingCreatedAt: createdAt,
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "forfeit",
      withinFreeCancelWindow: false,
    });
  });

  // ─── Provider: always refunds seeker ─────────────────────────────────────

  it("refunds seeker when provider cancels before arrival", () => {
    const now = localDate(2026, 2, 8, 10);
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "paid",
      bookingCreatedAt: localDate(2026, 2, 6, 9), // 2 days old — past seeker window
      pickupSlotTime: localDate(2026, 2, 8, 9),
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "refund",
      withinFreeCancelWindow: true, // provider is always considered "within window"
    });
  });

  it("refunds seeker when provider cancels with no pickup slot set", () => {
    const now = localDate(2026, 2, 8, 10);
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "paid",
      bookingCreatedAt: localDate(2026, 2, 1, 9), // 7 days old
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "refund",
    });
  });

  // ─── Unpaid fee — no refund action regardless ─────────────────────────────

  it("keeps refund action none when booking fee is unpaid (provider)", () => {
    const now = localDate(2026, 2, 8, 10);
    const decision = evaluateCancellationPolicy({
      actor: "provider",
      bookingFeeStatus: "pending",
      bookingCreatedAt: localDate(2026, 2, 8, 9),
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "none",
    });
  });

  it("keeps refund action none when booking fee is unpaid (seeker, within window)", () => {
    const createdAt = localDate(2026, 2, 8, 10);
    const now = new Date(createdAt.getTime() + 30 * 60 * 1000); // 30 min later

    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "pending",
      bookingCreatedAt: createdAt,
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "none",
    });
  });

  // ─── Already-refunded fee ─────────────────────────────────────────────────

  it("allows cancellation with no further refund when fee already refunded", () => {
    const createdAt = localDate(2026, 2, 8, 10);
    const now = new Date(createdAt.getTime() + 30 * 60 * 1000);

    const decision = evaluateCancellationPolicy({
      actor: "seeker",
      bookingFeeStatus: "refunded",
      bookingCreatedAt: createdAt,
      pickupSlotTime: null,
      now,
    });

    expect(decision).toMatchObject({
      allowed: true,
      refundAction: "none",
    });
  });
});
