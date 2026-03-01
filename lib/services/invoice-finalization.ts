/**
 * Shared logic for atomically creating an order from a booking invoice
 * and linking the booking to the new order.
 *
 * Used by:
 *   - pay-invoice (POST payment → order creation)
 *   - invoices/review (seeker approval → order creation)
 *
 * Supports two execution paths:
 *   1. Transaction-first (atomic via MongoDB sessions)
 *   2. Compensating fallback (for environments without replica sets)
 */

import { Db, MongoClient, MongoServerError, ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";

export type FinalizeOrderInput = {
  db: Db;
  client: MongoClient;
  bookingId: ObjectId;
  orderData: Record<string, unknown>;
  now: Date;
  /** Domain label for logs (e.g. "BOOKINGS", "INVOICES") */
  domain: string;
  /**
   * Optional: field name + value for duplicate order detection.
   * When set, an existing order matching this field is idempotent;
   * a mismatch throws DUPLICATE_RESOURCE.
   */
  duplicateCheck?: { field: string; value: unknown };
};

export type FinalizeOrderResult = {
  orderId: ObjectId;
  idempotent: boolean;
};

/** Detect if error is caused by missing replica-set / transaction support */
export function isTransactionUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("transaction numbers are only allowed on a replica set") ||
    msg.includes("replica set") ||
    msg.includes("mongos") ||
    msg.includes("transactions are not supported")
  );
}

// ─── Internal helpers ────────────────────────────────────────────────

async function syncBookingOrderLink(
  db: Db,
  bookingId: ObjectId,
  orderId: ObjectId,
  now: Date,
  session?: import("mongodb").ClientSession,
): Promise<void> {
  await db.collection("bookings").updateOne(
    {
      _id: bookingId,
      status: "invoice_created",
      $or: [{ order_id: { $exists: false } }, { order_id: null }],
    },
    {
      $set: {
        status: "completed",
        order_id: orderId,
        updatedAt: now,
      },
    },
    session ? { session } : undefined,
  );
}

function matchesDuplicate(
  existing: Record<string, unknown>,
  check?: { field: string; value: unknown },
): boolean {
  if (!check) return true; // no check ⇒ accept any existing
  return existing[check.field] === check.value;
}

// ─── Transaction path ────────────────────────────────────────────────

async function finalizeWithTransaction(
  input: FinalizeOrderInput,
): Promise<FinalizeOrderResult> {
  const { db, client, bookingId, orderData, now, duplicateCheck } = input;
  const session = client.startSession();
  let outcome: FinalizeOrderResult | null = null;

  try {
    await session.withTransaction(async () => {
      const existing = await db
        .collection("orders")
        .findOne({ booking_id: bookingId }, { session });

      if (existing) {
        if (matchesDuplicate(existing, duplicateCheck)) {
          await syncBookingOrderLink(
            db,
            bookingId,
            existing._id as ObjectId,
            now,
            session,
          );
          outcome = { orderId: existing._id as ObjectId, idempotent: true };
          return;
        }
        throw new AppError(
          ErrorCode.DUPLICATE_RESOURCE,
          409,
          "Order already exists for this booking",
        );
      }

      const insertResult = await db
        .collection("orders")
        .insertOne(orderData, { session });

      const bookingUpdate = await db.collection("bookings").updateOne(
        {
          _id: bookingId,
          status: "invoice_created",
          $or: [{ order_id: { $exists: false } }, { order_id: null }],
        },
        {
          $set: {
            status: "completed",
            order_id: insertResult.insertedId,
            updatedAt: now,
          },
        },
        { session },
      );

      if (bookingUpdate.modifiedCount === 0) {
        const latest = await db
          .collection("bookings")
          .findOne({ _id: bookingId }, { session });
        if (latest?.order_id && ObjectId.isValid(String(latest.order_id))) {
          outcome = {
            orderId: new ObjectId(String(latest.order_id)),
            idempotent: true,
          };
          return;
        }
        throw new AppError(
          ErrorCode.DUPLICATE_RESOURCE,
          409,
          "Booking state changed while finalizing order. Please retry.",
        );
      }

      outcome = { orderId: insertResult.insertedId, idempotent: false };
    });

    if (!outcome) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        "Unable to finalize invoice order",
      );
    }
    return outcome;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const concurrent = await db
        .collection("orders")
        .findOne({ booking_id: bookingId });
      if (concurrent && matchesDuplicate(concurrent, duplicateCheck)) {
        return { orderId: concurrent._id as ObjectId, idempotent: true };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

// ─── Compensation path ───────────────────────────────────────────────

async function finalizeWithCompensation(
  input: Omit<FinalizeOrderInput, "client">,
): Promise<FinalizeOrderResult> {
  const { db, bookingId, orderData, now, duplicateCheck } = input;
  let insertedOrderId: ObjectId | null = null;

  try {
    const insertResult = await db.collection("orders").insertOne(orderData);
    insertedOrderId = insertResult.insertedId;
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const existing = await db
        .collection("orders")
        .findOne({ booking_id: bookingId });
      if (existing && matchesDuplicate(existing, duplicateCheck)) {
        await syncBookingOrderLink(db, bookingId, existing._id as ObjectId, now);
        return { orderId: existing._id as ObjectId, idempotent: true };
      }
      if (!existing) throw error;
      throw new AppError(
        ErrorCode.DUPLICATE_RESOURCE,
        409,
        "Order already exists for this booking",
      );
    }
    throw error;
  }

  const bookingUpdate = await db.collection("bookings").updateOne(
    {
      _id: bookingId,
      status: "invoice_created",
      $or: [{ order_id: { $exists: false } }, { order_id: null }],
    },
    {
      $set: {
        status: "completed",
        order_id: insertedOrderId,
        updatedAt: now,
      },
    },
  );

  if (bookingUpdate.modifiedCount === 0) {
    // Compensate: remove the orphaned order
    if (insertedOrderId) {
      await db.collection("orders").deleteOne({
        _id: insertedOrderId,
        booking_id: bookingId,
      });
    }

    const latest = await db
      .collection("bookings")
      .findOne({ _id: bookingId });
    if (latest?.order_id && ObjectId.isValid(String(latest.order_id))) {
      return {
        orderId: new ObjectId(String(latest.order_id)),
        idempotent: true,
      };
    }

    throw new AppError(
      ErrorCode.DUPLICATE_RESOURCE,
      409,
      "Booking state changed while finalizing order. Please retry.",
    );
  }

  return { orderId: insertedOrderId as ObjectId, idempotent: false };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Create an order from a booking's invoice and atomically link them.
 * Tries a MongoDB transaction first; falls back to compensating writes
 * when transactions are unavailable.
 */
export async function finalizeInvoiceOrder(
  input: FinalizeOrderInput,
): Promise<FinalizeOrderResult> {
  try {
    return await finalizeWithTransaction(input);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (isTransactionUnavailable(error)) {
      logger.warn(
        input.domain,
        "Transactions unavailable; using compensating finalize path",
        { bookingId: input.bookingId.toString() },
      );
      return finalizeWithCompensation({
        db: input.db,
        bookingId: input.bookingId,
        orderData: input.orderData,
        now: input.now,
        domain: input.domain,
        duplicateCheck: input.duplicateCheck,
      });
    }

    throw error;
  }
}
