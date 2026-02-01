/**
 * Audit Logging Utility
 *
 * PRD Requirement (Section 9): "Capture: entity, previous state, next state,
 * actor, timestamp, and correlated payment identifiers."
 *
 * This module provides audit trail functionality for all state transitions
 * in the LaundryEase platform, ensuring compliance and traceability.
 */

import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { logger } from "./logger";

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | "booking"
  | "order"
  | "complaint"
  | "escrow"
  | "payment"
  | "payout"
  | "provider"
  | "seeker";

/**
 * Actor types that can perform auditable actions
 */
export type AuditActorType =
  | "seeker"
  | "provider"
  | "admin"
  | "system"
  | "webhook";

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  _id?: ObjectId;
  entity_type: AuditEntityType;
  entity_id: ObjectId;
  action: string;
  previous_state: string | null;
  next_state: string;
  actor_type: AuditActorType;
  actor_id: ObjectId | null; // null for system/webhook actions
  actor_email?: string | null;
  timestamp: Date;
  // Payment correlation identifiers
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payout_id?: string | null;
  // Additional metadata
  metadata?: Record<string, unknown>;
  // Related entities for cross-referencing
  related_booking_id?: ObjectId | null;
  related_order_id?: ObjectId | null;
}

/**
 * Create an audit log entry.
 *
 * This function is fire-and-forget by default to avoid blocking critical paths.
 * Errors are logged but do not propagate to callers.
 *
 * @param entry - The audit log entry to create
 * @returns Promise<ObjectId | null> - The inserted ID or null if failed
 */
export async function createAuditLog(
  entry: Omit<AuditLogEntry, "_id" | "timestamp">,
): Promise<ObjectId | null> {
  try {
    const { db } = await getDb();

    const auditEntry: Omit<AuditLogEntry, "_id"> = {
      ...entry,
      timestamp: new Date(),
    };

    const result = await db
      .collection<Omit<AuditLogEntry, "_id">>("audit_logs")
      .insertOne(auditEntry);
    return result.insertedId;
  } catch (error) {
    // Log error but don't throw - audit failures should not block business logic
    logger.error("AUDIT", "Failed to create audit log entry", error, {
      entity_type: entry.entity_type,
      entity_id: entry.entity_id?.toString(),
      action: entry.action,
    });
    return null;
  }
}

/**
 * Convenience function to audit a booking state change
 */
export async function auditBookingStateChange(params: {
  booking_id: ObjectId;
  previous_state: string | null;
  next_state: string;
  action: string;
  actor_type: AuditActorType;
  actor_id?: ObjectId | null;
  actor_email?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    entity_type: "booking",
    entity_id: params.booking_id,
    action: params.action,
    previous_state: params.previous_state,
    next_state: params.next_state,
    actor_type: params.actor_type,
    actor_id: params.actor_id ?? null,
    actor_email: params.actor_email,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_order_id: params.razorpay_order_id,
    metadata: params.metadata,
    related_booking_id: params.booking_id,
  });
}

/**
 * Convenience function to audit an order state change
 */
export async function auditOrderStateChange(params: {
  order_id: ObjectId;
  booking_id?: ObjectId;
  previous_state: string | null;
  next_state: string;
  action: string;
  actor_type: AuditActorType;
  actor_id?: ObjectId | null;
  actor_email?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payout_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    entity_type: "order",
    entity_id: params.order_id,
    action: params.action,
    previous_state: params.previous_state,
    next_state: params.next_state,
    actor_type: params.actor_type,
    actor_id: params.actor_id ?? null,
    actor_email: params.actor_email,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_order_id: params.razorpay_order_id,
    razorpay_payout_id: params.razorpay_payout_id,
    metadata: params.metadata,
    related_booking_id: params.booking_id,
    related_order_id: params.order_id,
  });
}

/**
 * Convenience function to audit escrow state changes
 */
export async function auditEscrowStateChange(params: {
  order_id: ObjectId;
  previous_state: string;
  next_state: string;
  action: string;
  actor_type: AuditActorType;
  actor_id?: ObjectId | null;
  razorpay_payment_id?: string | null;
  razorpay_payout_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    entity_type: "escrow",
    entity_id: params.order_id,
    action: params.action,
    previous_state: params.previous_state,
    next_state: params.next_state,
    actor_type: params.actor_type,
    actor_id: params.actor_id ?? null,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_payout_id: params.razorpay_payout_id,
    metadata: params.metadata,
    related_order_id: params.order_id,
  });
}

/**
 * Convenience function to audit payment events
 */
export async function auditPaymentEvent(params: {
  order_id: ObjectId;
  action: string;
  previous_status: string | null;
  next_status: string;
  actor_type: AuditActorType;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  amount?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    entity_type: "payment",
    entity_id: params.order_id,
    action: params.action,
    previous_state: params.previous_status,
    next_state: params.next_status,
    actor_type: params.actor_type,
    actor_id: null,
    razorpay_payment_id: params.razorpay_payment_id,
    razorpay_order_id: params.razorpay_order_id,
    metadata: {
      ...params.metadata,
      amount: params.amount,
    },
    related_order_id: params.order_id,
  });
}

/**
 * Convenience function to audit complaint state changes
 */
export async function auditComplaintStateChange(params: {
  complaint_id: ObjectId;
  order_id: ObjectId;
  previous_state: string | null;
  next_state: string;
  action: string;
  actor_type: AuditActorType;
  actor_id?: ObjectId | null;
  actor_email?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    entity_type: "complaint",
    entity_id: params.complaint_id,
    action: params.action,
    previous_state: params.previous_state,
    next_state: params.next_state,
    actor_type: params.actor_type,
    actor_id: params.actor_id ?? null,
    actor_email: params.actor_email,
    metadata: params.metadata,
    related_order_id: params.order_id,
  });
}
