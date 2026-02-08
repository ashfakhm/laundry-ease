import { ObjectId } from "mongodb";

export type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Order = {
  _id: ObjectId;
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  items: OrderItem[];
  total_price: number;
  delivery_distance_km?: number;
  delivery_charge: number;
  payment_status: "unpaid" | "paid" | "held" | "released" | "refunded";
  payment_made_at?: Date;
  escrow_started_at?: Date;
  escrow_release_at?: Date;
  escrow_released_at?: Date;
  otp_confirmed_at?: Date;
  cancellation_status?: "cancelled_by_seeker" | "cancelled_by_provider";
  createdAt: Date;
  process_status?:
    | "invoiced"
    | "processing"
    | "washing"
    | "ironing"
    | "ready"
    | "out_for_delivery"
    | "delivered";
  deadline?: Date;
  latePenalty?: number;
  deadline_breached_at?: Date;
  deadline_compensated_at?: Date;
  deadline_compensation_mode?: "full_refund" | "no_charge";
  refund_amount?: number;
  refund_reason?: string;
  razorpay_refund_id?: string;
  delivery_otp?: string;
  platform_commission?: number;
  provider_payout_amount?: number;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  payout_status?: "pending" | "processing" | "paid" | "failed";
  payout_id?: string;
  payout_lock_at?: Date;
  payout_failure_reason?: string;
  payout_failure_at?: Date;
  deliverySlot?: {
    proposedAt: Date;
    proposedBy: "provider"; // Only provider usually proposes delivery in this flow
    confirmedAt?: Date;
    dateTime: Date;
  };
};
