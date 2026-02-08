import { describe, expect, it } from "vitest";
import { auditIntegrity } from "./integrity";

const oid = (id: string) => id;

describe("auditIntegrity", () => {
  it("detects critical order payout/refund anomalies", () => {
    const anomalies = auditIntegrity({
      orders: [
        {
          _id: oid("order-1"),
          payment_status: "refunded",
          payout_status: "paid",
        },
      ],
      bookings: [],
      complaints: [],
      now: new Date("2026-02-08T00:00:00.000Z"),
    });

    expect(anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "order_refunded_but_payout_active",
          severity: "critical",
          entityType: "order",
          entityId: "order-1",
        }),
      ]),
    );
  });

  it("detects booking fee and complaint deadline anomalies", () => {
    const anomalies = auditIntegrity({
      orders: [],
      bookings: [
        {
          _id: oid("booking-1"),
          bookingFeeStatus: "applied",
          status: "confirmed",
        },
      ],
      complaints: [
        {
          _id: oid("complaint-1"),
          status: "accepted",
          response_deadline: "2026-02-01T00:00:00.000Z",
        },
      ],
      now: new Date("2026-02-08T00:00:00.000Z"),
    });

    expect(anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "booking_applied_missing_payout",
          entityType: "booking",
          entityId: "booking-1",
          severity: "high",
        }),
        expect.objectContaining({
          key: "complaint_review_deadline_breached",
          entityType: "complaint",
          entityId: "complaint-1",
          severity: "high",
        }),
      ]),
    );
  });

  it("detects stale payout processing and missing paid payment references", () => {
    const now = new Date("2026-02-08T00:00:00.000Z");
    const staleLock = new Date(now.getTime() - 20 * 60 * 1000);

    const anomalies = auditIntegrity({
      orders: [
        {
          _id: oid("order-2"),
          payment_status: "held",
          payout_status: "processing",
          payout_lock_at: staleLock,
        },
        {
          _id: oid("order-3"),
          payment_status: "released",
          payout_status: "pending",
          razorpay_payment_id: "",
        },
      ],
      bookings: [],
      complaints: [],
      now,
    });

    expect(anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "order_payout_processing_stale",
          entityType: "order",
          entityId: "order-2",
          severity: "high",
        }),
        expect.objectContaining({
          key: "order_paid_missing_payment_reference",
          entityType: "order",
          entityId: "order-3",
          severity: "high",
        }),
      ]),
    );
  });

  it("detects complaints in review without provider access", () => {
    const anomalies = auditIntegrity({
      orders: [],
      bookings: [],
      complaints: [
        {
          _id: oid("complaint-2"),
          status: "in_review",
          provider_access_granted: false,
        },
      ],
      now: new Date("2026-02-08T00:00:00.000Z"),
    });

    expect(anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "complaint_in_review_without_provider_access",
          entityType: "complaint",
          entityId: "complaint-2",
          severity: "high",
        }),
      ]),
    );
  });

  it("returns empty when no anomalies exist", () => {
    const anomalies = auditIntegrity({
      orders: [
        {
          _id: oid("order-1"),
          payment_status: "held",
          payout_status: "pending",
          razorpay_payment_id: "pay_ok",
        },
      ],
      bookings: [
        {
          _id: oid("booking-1"),
          bookingFeeStatus: "paid",
          status: "confirmed",
        },
      ],
      complaints: [
        {
          _id: oid("complaint-1"),
          status: "open",
        },
      ],
      now: new Date("2026-02-08T00:00:00.000Z"),
    });

    expect(anomalies).toEqual([]);
  });
});
