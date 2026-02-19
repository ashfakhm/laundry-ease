import { getBookingById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

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
      return legacyErrorResponse("Unauthorized", 401);
    }

    const { db } = await getDb();
    const provider = await db
      .collection("providers")
      .findOne({ _id: new ObjectId(user.id) });

    if (!provider) {
      return legacyErrorResponse("Provider not found", 404);
    }

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid booking id", 400);
    }
    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return legacyErrorResponse("Booking not found", 404);
    }

    if (booking.provider_id.toString() !== provider._id.toString()) {
      return legacyErrorResponse(
        "You are not authorized to reject this booking",
        403,
      );
    }

    if (booking.status !== "requested") {
      if (booking.status === "rejected") {
        return legacySuccessResponse({
          message: "Booking already rejected",
          idempotent: true,
        });
      }

      return legacyErrorResponse("Booking has already been acted upon", 400);
    }

    if (booking.bookingFeeStatus !== "paid") {
      return legacyErrorResponse(
        "Booking fee must be paid before provider can reject",
        400,
      );
    }

    if (!booking.razorpay_payment_id) {
      return legacyErrorResponse(
        "Cannot reject booking: payment reference missing for booking-fee refund.",
        409,
      );
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
        return legacySuccessResponse({
          message: "Booking already rejected",
          idempotent: true,
        });
      }
      if (latest?.refund_in_progress_at) {
        const lockAt = new Date(latest.refund_in_progress_at);
        const lockIsFresh =
          !Number.isNaN(lockAt.getTime()) &&
          Date.now() - lockAt.getTime() < REFUND_LOCK_TIMEOUT_MS;
        if (lockIsFresh) {
          return legacyErrorResponse(
            "Refund is already in progress for this booking.",
            409,
          );
        }
      }
      return legacyErrorResponse(
        "Booking status changed during rejection. Please refresh.",
        409,
      );
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
      return legacyErrorResponse(
        "Failed to refund booking fee. Booking was not rejected. Please retry.",
        502,
      );
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
        return legacySuccessResponse({
          message: "Booking already rejected",
          idempotent: true,
        });
      }

      return legacyErrorResponse(
        "Booking status changed during rejection. Refund has been processed; please refresh.",
        409,
      );
    }

    return legacySuccessResponse({ message: "Booking rejected and fee refunded" });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("BOOKINGS", "Error rejecting booking", error, {
      bookingId: id,
    });
    return legacyErrorResponse("Internal server error", 500);
  }
}
