import { ObjectId } from "mongodb";

export type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  photoUrl?: string; // Evidence
  notes?: string; // Specific notes
};

export type PaymentStatus =
  | "unpaid"
  | "paid"
  | "held"
  | "released"
  | "refunded";
export type OrderProcessStatus =
  | "invoiced"
  | "processing"
  | "washing"
  | "ironing"
  | "ready"
  | "out_for_delivery"
  | "delivered";

/**
 * Represents a confirmed Laundry Order.
 */
export interface Order {
  _id: ObjectId;
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;

  items: OrderItem[];

  // Financials
  subtotal?: number;
  discount?: number;
  delivery_charge: number;
  delivery_distance_km?: number;
  total_price: number;

  // Status Tracking
  payment_status: PaymentStatus;
  process_status: OrderProcessStatus;

  // Timestamps
  payment_made_at?: Date;
  escrow_started_at?: Date;
  escrow_release_at?: Date;
  escrow_released_at?: Date;
  otp_confirmed_at?: Date;
  deadline?: Date;

  // Cancellation
  cancellation_status?: "cancelled_by_seeker" | "cancelled_by_provider";

  // Compliance & Quality
  extended_complaint_window_until?: Date;
  latePenalty?: number;
  deadline_breached_at?: Date;
  deadline_compensated_at?: Date;
  deadline_compensation_mode?: "full_refund" | "no_charge";

  // Refunds
  refund_amount?: number;
  refund_reason?: string;
  razorpay_refund_id?: string;

  // Payouts
  platform_commission?: number;
  provider_payout_amount?: number;
  payout_status?: "pending" | "processing" | "paid" | "failed";
  payout_id?: string;
  payout_lock_at?: Date;
  payout_failure_reason?: string;
  payout_failure_at?: Date;

  // External Refs
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  delivery_otp?: string;
  delivery_otp_sent_at?: Date;
  delivery_otp_expires_at?: Date;
  delivery_otp_resend_count?: number;

  // Scheduling
  deliverySlot?: {
    proposedAt: Date;
    proposedBy: "provider";
    confirmedAt?: Date;
    dateTime: Date;
  };

  createdAt: Date;
  updatedAt?: Date;
}
