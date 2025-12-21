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
};
