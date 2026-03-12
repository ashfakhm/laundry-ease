import { Order } from "@/types/orders";
import { getDb } from "../mongodb";
import { ObjectId } from "mongodb";
import { auditEscrowStateChange } from "../audit";
import { logger } from "@/lib/logger";

/**
 * Release escrow payment for an order
 * IDEMPOTENT: Safe to call multiple times - will only update if status is "held"
 */
export async function releaseEscrowPayment(order_id: ObjectId) {
  const { db, client } = await getDb();

  const session = client.startSession();

  try {
    return await session.withTransaction(async () => {
      // IDEMPOTENCY CHECK: Verify order is in "held" status before releasing
      const order = await db
        .collection<Order>("orders")
        .findOne({ _id: order_id }, { session });
      if (!order) {
        return false;
      }

      // If already released or not in held status, return false (idempotent)
      if (order.payment_status !== "held") {
        return order.payment_status === "released"; // Return true if already released (idempotent success)
      }

      // VALIDATION: Check for active complaints before releasing
      // Block if ANY complaint is not fully resolved/rejected.
      const openComplaint = await db.collection("complaints").findOne(
        {
          order_id: new ObjectId(order_id),
          status: { $nin: ["resolved", "rejected"] },
        },
        { session },
      );

      if (openComplaint) {
        // Escrow release blocked due to open complaint - this is expected behavior
        return false;
      }

      // Atomic update: Only update if still in "held" status (prevents race conditions)
      const res = await db.collection<Order>("orders").updateOne(
        { _id: order_id, payment_status: "held" }, // Ensure still "held" before updating
        {
          $set: { payment_status: "released", escrow_released_at: new Date() },
        },
        { session },
      );

      const success = res.modifiedCount > 0;

      // Audit log - escrow released (fire-and-forget, non-blocking)
      if (success) {
        auditEscrowStateChange({
          order_id,
          previous_state: "held",
          next_state: "released",
          action: "escrow_released",
          actor_type: "system",
          razorpay_payment_id: order.razorpay_payment_id || null,
          metadata: {
            provider_payout_amount: order.provider_payout_amount,
            escrow_started_at: order.escrow_started_at,
          },
        });
      }

      return success;
    });
  } catch (error) {
    logger.error(
      "ESCROW",
      `Failed to release escrow for order ${order_id.toString()}:`,
      error,
    );
    return false;
  } finally {
    await session.endSession();
  }
}

/**
 * Force freeze escrow (explicitly mark as disputed if needed)
 * Effectively handled by createComplaint, but this ensures payment status reflects it.
 */
export async function freezeEscrow(order_id: ObjectId) {
  // We don't strictly change status to 'disputed' to avoid breaking enum types in MVP,
  // but we could. For now, we rely on the complaint check in releaseEscrowPayment.

  // Persist an explicit flag to make the freeze auditable and queryable.
  try {
    const { db } = await getDb();
    await db
      .collection<Order>("orders")
      .updateOne(
        { _id: order_id },
        { $set: { escrow_frozen: true, escrow_frozen_at: new Date() } },
      );
  } catch (error) {
    logger.error(
      "ESCROW",
      `Failed to explicitly freeze escrow for order ${order_id.toString()}:`,
      error,
    );
    // Error persisting escrow_frozen flag - continue silently as complaint still blocks release
  }
}
