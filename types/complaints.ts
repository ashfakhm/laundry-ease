import { ObjectId } from "mongodb";

export type Complaint = {
  _id: ObjectId;
  order_id: ObjectId;
  booking_id: ObjectId; // Linked booking
  seeker_id: ObjectId;
  provider_id: ObjectId;

  // Metadata
  complaint_type: string;
  title: string;
  description: string;
  photos?: string[];

  // State
  // FAANG-Grade State Machine:
  // OPEN: Initial state. Payment blocked. Awaiting admin review.
  // ACCEPTED: Admin acknowledged. Payment blocked. Chat active. Provider NOT yet in chat.
  // IN_REVIEW: Provider added to chat. Active mediation. Payment blocked.
  // RESOLVED: Admin decided. Payment Executed. Chat archived.
  // REJECTED: Invalid complaint. Escrow released. Chat archived.
  status: "open" | "accepted" | "in_review" | "resolved" | "rejected";

  resolution_outcome?:
    | "refund_full"
    | "refund_partial"
    | "release_payout"
    | "no_action";

  // Deadline Tracking
  acceptedAt?: Date;
  response_deadline?: Date; // Provider must respond by this date (typically 3-7 days from acceptance)

  // Chat & Access
  participants: ObjectId[];
  provider_access_granted: boolean;

  createdAt: Date;
  resolvedAt?: Date;
};

export type ComplaintMessage = {
  _id: ObjectId;
  complaint_id: ObjectId;
  sender_id: ObjectId; // If system, maybe null or admin ID? We'll enforce role='system'
  sender_role: "seeker" | "provider" | "admin" | "system";
  message_type: "TEXT" | "IMAGE" | "VOICE" | "SYSTEM"; // Added for type enforcement
  content: string;
  attachments?: string[];
  voiceMessage?: string;
  createdAt: Date;
};
