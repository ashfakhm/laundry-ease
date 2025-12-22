import { ObjectId } from "mongodb";

export interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  photoUrl?: string; // Phase 5: Evidence
  notes?: string;   // Phase 5: Specific notes
}

export type PaymentStatus = "unpaid" | "paid" | "held" | "released" | "refunded";
export type OrderProcessStatus = "invoiced" | "processing" | "ready" | "out_for_delivery" | "delivered";
/**
 * Represents a confirmed Laundry Order.
 * PRD Section 9.4
 */
export interface Order {
  _id?: ObjectId | string;
  booking_id: ObjectId | string;
  seeker_id: ObjectId | string;
  provider_id: ObjectId | string;
  
  items: OrderItem[];
  
  // Financials
  subtotal: number;
  discount: number;
  delivery_charge: number;
  total_price: number; // Final amount to be paid (Net)
  
  // Status Tracking
  payment_status: PaymentStatus;
  process_status: OrderProcessStatus;
  
  // Timestamps
  payment_made_at?: Date | string;
  escrow_started_at?: Date | string;
  escrow_release_at?: Date | string;
  otp_confirmed_at?: Date | string;
  
  // Cancellation
  cancellation_status?: "cancelled_by_seeker" | "cancelled_by_provider";
  
  createdAt: Date | string;
  updatedAt: Date | string;
}
