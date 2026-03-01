/**
 * Shared refund-lock helpers for booking refund operations.
 *
 * Cancel, reject (and potentially admin) routes all need to:
 *   1. Acquire a distributed lock on the booking to prevent concurrent refunds
 *   2. Release that lock on failure
 *   3. Diagnose why the lock failed (already processed? fresh lock held?)
 */

import { Db, ObjectId } from "mongodb";
import { REFUND_LOCK_TIMEOUT_MS } from "@/lib/constants";
import { AppError, ErrorCode } from "@/lib/api/errors";

/**
 * Attempt to acquire an exclusive refund lock on a booking.
 * Uses `refund_in_progress_at` with a stale-lock timeout.
 * @returns true if the lock was acquired, false otherwise.
 */
export async function acquireBookingRefundLock(
  db: Db,
  bookingId: ObjectId,
  currentStatus: string,
): Promise<boolean> {
  const lockCutoff = new Date(Date.now() - REFUND_LOCK_TIMEOUT_MS);
  const result = await db.collection("bookings").updateOne(
    {
      _id: bookingId,
      status: currentStatus,
      bookingFeeStatus: "paid",
      $or: [
        { refund_in_progress_at: { $exists: false } },
        { refund_in_progress_at: { $lt: lockCutoff } },
      ],
    },
    {
      $set: {
        refund_in_progress_at: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  return result.modifiedCount > 0;
}

/**
 * Release the refund lock without any status change (error recovery path).
 */
export async function releaseBookingRefundLock(
  db: Db,
  bookingId: ObjectId,
): Promise<void> {
  await db.collection("bookings").updateOne(
    { _id: bookingId },
    {
      $unset: { refund_in_progress_at: "" },
      $set: { updatedAt: new Date() },
    },
  );
}

/**
 * After a failed lock acquisition, determine the correct error response.
 * Returns an `AppError` describing the conflict.
 *
 * @param idempotentStatus - "cancelled" or "rejected"; if the booking is
 *   already in this status, the caller should treat it as a no-op success.
 */
export async function diagnoseBookingLockFailure(
  db: Db,
  bookingId: ObjectId,
  idempotentStatus: string,
): Promise<{ idempotent: true } | AppError> {
  const latest = await db.collection("bookings").findOne({ _id: bookingId });

  if (latest?.status === idempotentStatus) {
    return { idempotent: true };
  }

  if (latest?.refund_in_progress_at) {
    const lockAt = new Date(latest.refund_in_progress_at);
    const lockIsFresh =
      !Number.isNaN(lockAt.getTime()) &&
      Date.now() - lockAt.getTime() < REFUND_LOCK_TIMEOUT_MS;
    if (lockIsFresh) {
      return new AppError(
        ErrorCode.CONFLICT,
        409,
        "Refund is already in progress for this booking.",
      );
    }
  }

  return new AppError(
    ErrorCode.CONFLICT,
    409,
    "Booking status changed. Please refresh and retry.",
  );
}
