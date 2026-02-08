import type { ObjectId } from "mongodb";

type OrderAuditShape = {
  _id: ObjectId | string;
  payment_status?: string;
  payout_status?: string;
  payout_id?: string;
  escrow_released_at?: Date | string;
};

type BookingAuditShape = {
  _id: ObjectId | string;
  status?: string;
  bookingFeeStatus?: string;
  payout_id?: string;
};

type ComplaintAuditShape = {
  _id: ObjectId | string;
  status?: string;
  resolvedAt?: Date | string;
  response_deadline?: Date | string;
};

export type IntegritySeverity = "critical" | "high" | "medium";

export type IntegrityAnomaly = {
  key: string;
  entityType: "order" | "booking" | "complaint";
  entityId: string;
  severity: IntegritySeverity;
  message: string;
};

type IntegrityAuditInput = {
  orders: OrderAuditShape[];
  bookings: BookingAuditShape[];
  complaints: ComplaintAuditShape[];
  now?: Date;
};

function toIdString(value: ObjectId | string): string {
  return typeof value === "string" ? value : value.toString();
}

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasExpiredDeadline(
  responseDeadline: Date | string | undefined,
  now: Date,
): boolean {
  const deadline = toDate(responseDeadline);
  return Boolean(deadline && deadline.getTime() < now.getTime());
}

export function auditIntegrity(input: IntegrityAuditInput): IntegrityAnomaly[] {
  const now = input.now ?? new Date();
  const anomalies: IntegrityAnomaly[] = [];

  for (const order of input.orders) {
    const orderId = toIdString(order._id);
    const paymentStatus = order.payment_status;
    const payoutStatus = order.payout_status;

    if (
      paymentStatus === "refunded" &&
      (payoutStatus === "processing" || payoutStatus === "paid")
    ) {
      anomalies.push({
        key: "order_refunded_but_payout_active",
        entityType: "order",
        entityId: orderId,
        severity: "critical",
        message: "Order is refunded while payout is processing/paid.",
      });
    }

    if (
      (paymentStatus === "unpaid" || paymentStatus === "refunded") &&
      Boolean(order.payout_id)
    ) {
      anomalies.push({
        key: "order_invalid_payout_reference",
        entityType: "order",
        entityId: orderId,
        severity: "high",
        message: "Order has payout reference in a non-payable payment state.",
      });
    }

    if (paymentStatus === "released" && !order.escrow_released_at) {
      anomalies.push({
        key: "order_released_missing_timestamp",
        entityType: "order",
        entityId: orderId,
        severity: "medium",
        message: "Order payment is released but escrow_released_at is missing.",
      });
    }
  }

  for (const booking of input.bookings) {
    const bookingId = toIdString(booking._id);

    if (booking.bookingFeeStatus === "applied" && !booking.payout_id) {
      anomalies.push({
        key: "booking_applied_missing_payout",
        entityType: "booking",
        entityId: bookingId,
        severity: "high",
        message: "Booking fee is applied but payout_id is missing.",
      });
    }

    if (
      booking.bookingFeeStatus === "refunded" &&
      booking.status !== "cancelled" &&
      booking.status !== "rejected"
    ) {
      anomalies.push({
        key: "booking_refunded_unexpected_status",
        entityType: "booking",
        entityId: bookingId,
        severity: "medium",
        message: "Booking fee is refunded while booking status is not cancelled/rejected.",
      });
    }
  }

  for (const complaint of input.complaints) {
    const complaintId = toIdString(complaint._id);

    if (
      (complaint.status === "resolved" || complaint.status === "rejected") &&
      !complaint.resolvedAt
    ) {
      anomalies.push({
        key: "complaint_finalized_missing_timestamp",
        entityType: "complaint",
        entityId: complaintId,
        severity: "medium",
        message: "Complaint is finalized but resolvedAt is missing.",
      });
    }

    if (
      (complaint.status === "accepted" || complaint.status === "in_review") &&
      hasExpiredDeadline(complaint.response_deadline, now)
    ) {
      anomalies.push({
        key: "complaint_review_deadline_breached",
        entityType: "complaint",
        entityId: complaintId,
        severity: "high",
        message: "Complaint review deadline has passed while complaint remains unresolved.",
      });
    }
  }

  return anomalies;
}
