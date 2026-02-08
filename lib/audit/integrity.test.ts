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

  it("returns empty when no anomalies exist", () => {
    const anomalies = auditIntegrity({
      orders: [
        {
          _id: oid("order-1"),
          payment_status: "held",
          payout_status: "pending",
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
