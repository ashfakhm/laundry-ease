import { getBookingById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";

const REFUND_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:reject",
      max: 15,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const { db } = await getDb();
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(user.id) });

    if (!provider) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found"));
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id"));
    }
    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));
    }

    if (booking.provider_id.toString() !== provider._id.toString()) {
      return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "You are not authorized to reject this booking"));
    }

    if (booking.status !== "requested") {
      if (booking.status === "rejected") {
        return successResponse({ message: "Booking already rejected",
          idempotent: true });
      }

      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Booking has already been acted upon"));
    }

    if (booking.bookingFeeStatus !== "paid") {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Booking fee must be paid before provider can reject"));
    }

    if (!booking.razorpay_payment_id) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Cannot reject booking: payment reference missing for booking-fee refund."));
    }

    const lockCutoff = new Date(Date.now() - REFUND_LOCK_TIMEOUT_MS);
    const lockResult = await db.collection("bookings").updateOne(
      {
        _id: booking_id,
        status: "requested",
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
      }
    );

    if (lockResult.modifiedCount === 0) {
      const latest = await db.collection("bookings").findOne({ _id: booking_id });
      if (latest?.status === "rejected") {
        return successResponse({ message: "Booking already rejected",
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
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Booking status changed during rejection. Please refresh."));
    }

    let refundId: string | null = null;
    try {
      const refund = await refundRazorpayPayment(
        booking.razorpay_payment_id,
        undefined,
        {
          reason: "provider_rejected_booking",
          booking_id: id,
        }
      );
      refundId = refund.id || null;
    } catch (error) {
      await db.collection("bookings").updateOne(
        { _id: booking_id },
        {
          $unset: { refund_in_progress_at: "" },
          $set: { updatedAt: new Date() },
        }
      );

      logger.error(
        "BOOKINGS",
        "Failed to refund booking fee during rejection",
        error,
        { bookingId: id }
      );
      return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 502, "Failed to refund booking fee. Booking was not rejected. Please retry."));
    }

    const now = new Date();
    const updateResult = await db.collection("bookings").updateOne(
      {
        _id: booking_id,
        status: "requested",
        bookingFeeStatus: "paid",
        refund_in_progress_at: { $exists: true },
      },
      {
        $set: {
          status: "rejected",
          bookingFeeStatus: "refunded",
          refundProcessedAt: now,
          ...(refundId ? { booking_fee_refund_id: refundId } : {}),
          updatedAt: now,
        },
        $unset: { refund_in_progress_at: "" },
      }
    );

    if (updateResult.modifiedCount === 0) {
      const latest = await db.collection("bookings").findOne({ _id: booking_id });
      if (latest?.bookingFeeStatus === "paid") {
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
          }
        );
      } else {
        await db.collection("bookings").updateOne(
          { _id: booking_id },
          {
            $unset: { refund_in_progress_at: "" },
            $set: { updatedAt: now },
          }
        );
      }

      const latestAfter = await db.collection("bookings").findOne({ _id: booking_id });
      if (latestAfter?.status === "rejected") {
        return successResponse({ message: "Booking already rejected",
          idempotent: true });
      }

      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Booking status changed during rejection. Refund has been processed; please refresh."));
    }

    return successResponse({ message: "Booking rejected and fee refunded" });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("BOOKINGS", "Error rejecting booking", error, {
      bookingId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
