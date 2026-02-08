import { ObjectId } from "mongodb";

export type BookingStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "pickup_proposed"
  | "reschedule_requested"
  | "confirmed"
  | "invoice_created"
  | "cancelled"
  | "completed";

export interface InvoiceItem {
  itemType: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  items: InvoiceItem[];
  notes?: string;
  photos?: string[];
  createdAt: Date | string;
}

export interface SeekerDetails {
  _id: string; // ID is string after Population/Serialization
  name: string;
  email: string;
  phone: string;
  address?: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  image?: string;
}

export type Booking = {
  _id: ObjectId | string;
  seeker_id: ObjectId | string;
  provider_id: ObjectId | string;
  status: BookingStatus;
  bookingFee?: number;
  bookingFeeStatus?: "pending" | "paid" | "refunded" | "forfeited" | "applied";
  pickupSlot?: {
    proposedBy: "provider" | "seeker";
    dateTime: Date | string;
    confirmedAt?: Date | string;
  };

  reschedule?: {
    requestedBy: "seeker" | "provider";
    requestedAt: Date | string;
    reason?: string;
    count: number;
    previousPickupSlot?: {
      dateTime: Date | string;
      confirmedAt?: Date | string;
    };
  };
  arrivedAt?: Date | string; // Provider arrival timestamp
  cancelledAt?: Date | string;
  cancelledBy?: "seeker" | "provider";
  cancellation_reason?: string;

  invoice?: InvoiceData;
  seeker_coordinates?: { lat: number; lng: number };
  noShowStatus?: boolean;
  deadline?: Date | string;
  createdAt: Date | string;
  updatedAt?: Date | string;

  // Payment & Payout Fields
  platform_commission?: number;
  provider_payout_amount?: number;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  payout_status?: "pending" | "processing" | "paid" | "failed";
  payout_id?: string;
  payout_utr?: string;
  payout_initiated_at?: Date | string;
  payout_updated_at?: Date | string;
  booking_fee_released_at?: Date | string;
  booking_fee_applied_at?: Date | string;
  refundProcessedAt?: Date | string;
  booking_fee_refund_id?: string;
  refund_in_progress_at?: Date | string;
};

export type PopulatedBooking = Omit<Booking, "seeker_id"> & {
  seeker: SeekerDetails;
};

export interface ProviderDetails {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address?: string; // Provider might have a shop address or base location
  businessName?: string;
  profilePicture?: string;
  bannerImage?: string;
}

// Booking populated with Provider details (for Seeker view)
export type PopulatedSeekerBooking = Omit<Booking, "provider_id"> & {
  provider: ProviderDetails;
};
