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
import {
  acquireBookingRefundLock,
  releaseBookingRefundLock,
  diagnoseBookingLockFailure,
} from "@/lib/services/refund-lock";

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
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"),
      );
    }
    const booking_id = new ObjectId(id);

    const booking = await getBookingById(booking_id);

    if (!booking) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
      );
    }

    if (booking.status === "cancelled") {
      return successResponse({
        message: "Booking already cancelled",
        idempotent: true,
      });
    }

    const isProvider = user.role === Role.PROVIDER;
    const body = await req.json().catch(() => null);
    const cancellationReason =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 280)
        : undefined;

    if (isProvider && !cancellationReason) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Provider cancellation reason is required",
        ),
      );
    }

    const { db } = await getDb();
    const now = new Date();
    const pickupSlotTime = toValidDate(booking.pickupSlot?.dateTime);

    let cancelledBy: "seeker" | "provider" = "seeker";
    let allowedStatuses: string[] = ["requested", "pickup_proposed"];

    if (isProvider) {
      if (booking.provider_id.toString() !== user.id) {
        return errorResponse(
          new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
        );
      }

      if (booking.arrivedAt) {
        return errorResponse(
          new AppError(
            ErrorCode.CONFLICT,
            409,
            "Provider cannot cancel after marking arrival",
          ),
        );
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
        return errorResponse(
          new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"),
        );
      }
      cancelledBy = "seeker";
      allowedStatuses = [
        "requested",
        "accepted",
        "pickup_proposed",
        "reschedule_requested",
        "confirmed",
        "invoice_created",
      ];

      // At invoice_created the provider has already arrived (pickup slot is in the past by definition).
      // Allow cancellation here — the seeker forfeits the booking fee as compensation.
      if (
        booking.status !== "invoice_created" &&
        pickupSlotTime &&
        now >= pickupSlotTime
      ) {
        return errorResponse(
          new AppError(
            ErrorCode.CONFLICT,
            409,
            "Seeker can cancel only before the booked slot time.",
          ),
        );
      }
    }

    if (!allowedStatuses.includes(booking.status)) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          `Cannot cancel booking with status: ${booking.status}. Contact support.`,
        ),
      );
    }

    const bookingCreatedAt = booking.createdAt
      ? new Date(booking.createdAt as string | Date)
      : now;

    const policy = evaluateCancellationPolicy({
      actor: isProvider ? "provider" : "seeker",
      bookingFeeStatus: booking.bookingFeeStatus,
      bookingCreatedAt,
      pickupSlotTime,
      now,
      bookingStatus: booking.status,
    });

    if (!policy.allowed) {
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          policy.message || "Cancellation is not allowed.",
        ),
      );
    }

    const shouldAttemptRefund = policy.refundAction === "refund";
    const shouldForfeitFee = policy.refundAction === "forfeit";

    let refundId: string | null = null;
    let shouldMarkRefunded = false;
    if (shouldAttemptRefund) {
      if (!booking.razorpay_payment_id) {
        return errorResponse(
          new AppError(
            ErrorCode.CONFLICT,
            409,
            "Cannot cancel with refund: payment reference missing. Please contact support.",
          ),
        );
      }

      const lockAcquired = await acquireBookingRefundLock(
        db,
        booking_id,
        booking.status,
      );

      if (!lockAcquired) {
        const diagnosis = await diagnoseBookingLockFailure(
          db,
          booking_id,
          "cancelled",
        );
        if ("idempotent" in diagnosis) {
          return successResponse({
            message: "Booking already cancelled",
            idempotent: true,
          });
        }
        return errorResponse(diagnosis);
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
        await releaseBookingRefundLock(db, booking_id);

        logger.error(
          "BOOKINGS",
          "Failed to refund booking fee on cancel",
          error,
          {
            bookingId: id,
            cancelledBy,
          },
        );
        return errorResponse(
          new AppError(
            ErrorCode.INTERNAL_ERROR,
            502,
            "Refund could not be processed right now, so booking was not cancelled. Please retry.",
          ),
        );
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
      return successResponse({
        message: shouldMarkRefunded
          ? "Booking cancelled and booking fee refunded"
          : shouldForfeitFee
            ? "Booking cancelled. The 2-hour free-cancel window has passed — booking fee is non-refundable."
            : "Booking cancelled successfully",
      });
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
      return successResponse({
        message: "Booking already cancelled",
        idempotent: true,
      });
    }

    return errorResponse(
      new AppError(
        ErrorCode.CONFLICT,
        409,
        shouldMarkRefunded
          ? "Booking status changed. Refund has been processed; please refresh and retry."
          : shouldForfeitFee
            ? "Booking status changed. The 2-hour free-cancel window has passed; booking fee is non-refundable. Please refresh and retry."
            : "Booking status changed. Please refresh and retry.",
      ),
    );
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error cancelling booking", error, {
      bookingId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
