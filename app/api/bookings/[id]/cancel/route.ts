import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getBookingById } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { Role } from "@/types/enums";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { evaluateCancellationPolicy } from "@/lib/bookings/cancellation-policy";
import { requireAuth } from "@/lib/api/auth";
import { errorResponse, successResponse } from "@/lib/api/response";

const REFUND_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:cancel",
      max: 15,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"));
    }
    const booking_id = new ObjectId(id);

    const booking = await getBookingById(booking_id);

    if (!booking) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));
    }

    if (booking.status === "cancelled") {
      return successResponse({ message: "Booking already cancelled",
        idempotent: true });
    }

    const body = await req.json().catch(() => null);
    const cancellationReason =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 280)
        : undefined;

    const isProvider = user.role === Role.PROVIDER;
    const { db } = await getDb();
    const now = new Date();
    const pickupSlotTime = toValidDate(booking.pickupSlot?.dateTime);

    let cancelledBy: "seeker" | "provider" = "seeker";
    let allowedStatuses: string[] = ["requested", "pickup_proposed"];

    if (isProvider) {
      if (booking.provider_id.toString() !== user.id) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
      }

      if (booking.arrivedAt) {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Provider cannot cancel after marking arrival"));
      }

      cancelledBy = "provider";
      allowedStatuses = [
        "requested",
        "accepted",
        "pickup_proposed",
        "reschedule_requested",
        "confirmed",
      ];
    } else {
      if (booking.seeker_id.toString() !== user.id) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
      }
      cancelledBy = "seeker";
      allowedStatuses = [
        "requested",
        "accepted",
        "pickup_proposed",
        "reschedule_requested",
        "confirmed",
      ];

      if (pickupSlotTime && now >= pickupSlotTime) {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Seeker can cancel only before the booked slot time."));
      }
    }

    if (!allowedStatuses.includes(booking.status)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, `Cannot cancel booking with status: ${booking.status}. Contact support.`));
    }

    const policy = evaluateCancellationPolicy({
      actor: isProvider ? "provider" : "seeker",
      bookingFeeStatus: booking.bookingFeeStatus,
      pickupSlotTime,
      now,
    });

    if (!policy.allowed) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, policy.message || "Cancellation is not allowed."));
    }

    const shouldAttemptRefund = policy.refundAction === "refund";
    const shouldForfeitFee = policy.refundAction === "forfeit";

    let refundId: string | null = null;
    let shouldMarkRefunded = false;
    if (shouldAttemptRefund) {
      if (!booking.razorpay_payment_id) {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Cannot cancel with refund: payment reference missing. Please contact support."));
      }

      const lockCutoff = new Date(Date.now() - REFUND_LOCK_TIMEOUT_MS);
      const lockResult = await db.collection("bookings").updateOne(
        {
          _id: booking_id,
          status: booking.status,
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

      if (lockResult.modifiedCount === 0) {
        const latest = await db
          .collection("bookings")
          .findOne({ _id: booking_id });
        if (latest?.status === "cancelled") {
          return successResponse({ message: "Booking already cancelled",
            idempotent: true });
        }
        if (latest?.refund_in_progress_at) {
          const lockAt = new Date(latest.refund_in_progress_at);
          const lockIsFresh =
            !Number.isNaN(lockAt.getTime()) &&
            Date.now() - lockAt.getTime() < REFUND_LOCK_TIMEOUT_MS;
          if (lockIsFresh) {
            return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Refund is already in progress for this booking."));
          }
        }
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Booking status changed. Please refresh and retry."));
      }

      try {
        const refund = await refundRazorpayPayment(
          booking.razorpay_payment_id,
          undefined,
          {
            reason: `${cancelledBy}_cancelled_booking`,
            booking_id: id,
          },
        );
        refundId = refund.id || null;
        shouldMarkRefunded = true;
      } catch (error) {
        await db.collection("bookings").updateOne(
          { _id: booking_id },
          {
            $unset: { refund_in_progress_at: "" },
            $set: { updatedAt: new Date() },
          },
        );

        logger.error(
          "BOOKINGS",
          "Failed to refund booking fee on cancel",
          error,
          {
            bookingId: id,
            cancelledBy,
          },
        );
        return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 502, "Refund could not be processed right now, so booking was not cancelled. Please retry."));
      }
    }

    const result = await db.collection("bookings").updateOne(
      { _id: booking_id, status: booking.status },
      {
        $set: {
          status: "cancelled",
          cancelledBy,
          cancelledAt: now,
          ...(cancellationReason
            ? { cancellation_reason: cancellationReason }
            : {}),
          ...(shouldMarkRefunded
            ? {
                bookingFeeStatus: "refunded",
                refundProcessedAt: now,
                ...(refundId ? { booking_fee_refund_id: refundId } : {}),
              }
            : {}),
          ...(shouldForfeitFee
            ? {
                bookingFeeStatus: "forfeited",
              }
            : {}),
          updatedAt: now,
        },
        ...(shouldAttemptRefund
          ? { $unset: { refund_in_progress_at: "" } }
          : {}),
      },
    );

    if (result.modifiedCount === 1) {
      return successResponse({ message: shouldMarkRefunded
          ? "Booking cancelled and booking fee refunded"
          : shouldForfeitFee
            ? "Booking cancelled. Same-day cancellation is non-refundable."
            : "Booking cancelled successfully" });
    }

    const latest = await db.collection("bookings").findOne({ _id: booking_id });
    if (shouldMarkRefunded && latest?.bookingFeeStatus === "paid") {
      await db.collection("bookings").updateOne(
        { _id: booking_id, bookingFeeStatus: "paid" },
        {
          $set: {
            bookingFeeStatus: "refunded",
            refundProcessedAt: now,
            ...(refundId ? { booking_fee_refund_id: refundId } : {}),
            updatedAt: now,
          },
          $unset: { refund_in_progress_at: "" },
        },
      );
    } else if (shouldForfeitFee && latest?.bookingFeeStatus === "paid") {
      await db.collection("bookings").updateOne(
        { _id: booking_id, bookingFeeStatus: "paid" },
        {
          $set: {
            bookingFeeStatus: "forfeited",
            updatedAt: now,
          },
        },
      );
    } else if (shouldMarkRefunded || latest?.refund_in_progress_at) {
      await db.collection("bookings").updateOne(
        { _id: booking_id },
        {
          $unset: { refund_in_progress_at: "" },
          $set: { updatedAt: now },
        },
      );
    }

    const latestAfter = await db
      .collection("bookings")
      .findOne({ _id: booking_id });
    if (latestAfter?.status === "cancelled") {
      return successResponse({ message: "Booking already cancelled",
        idempotent: true });
    }

    return errorResponse(new AppError(ErrorCode.CONFLICT, 409,
      shouldMarkRefunded
        ? "Booking status changed. Refund has been processed; please refresh and retry."
        : shouldForfeitFee
          ? "Booking status changed. Same-day cancellation is non-refundable; please refresh and retry."
          : "Booking status changed. Please refresh and retry."
    ));
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error cancelling booking", error, {
      bookingId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
