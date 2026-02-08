import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { Role } from "@/types/enums";
import { refundRazorpayPayment } from "@/lib/razorpay";

const REFUND_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let booking_id: ObjectId;
    try {
      booking_id = new ObjectId(id);
    } catch {
      return NextResponse.json({ message: "Invalid booking id" }, { status: 400 });
    }

    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({
        success: true,
        message: "Booking already cancelled",
        idempotent: true,
      });
    }

    const body = await req.json().catch(() => null);
    const cancellationReason =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 280)
        : undefined;

    const isProvider = session.user.role === Role.PROVIDER;
    const { db } = await getDb();
    const now = new Date();
    const pickupSlotTime = toValidDate(booking.pickupSlot?.dateTime);

    let cancelledBy: "seeker" | "provider" = "seeker";
    let allowedStatuses: string[] = ["requested", "pickup_proposed"];

    if (isProvider) {
      if (!session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      const provider = await db
        .collection("providers")
        .findOne({ email: session.user.email });

      if (!provider || booking.provider_id.toString() !== provider._id.toString()) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
      }

      if (booking.arrivedAt) {
        return NextResponse.json(
          { message: "Provider cannot cancel after marking arrival" },
          { status: 409 },
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
      if (booking.seeker_id.toString() !== session.user.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
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
        return NextResponse.json(
          { message: "Seeker can cancel only before the booked slot time." },
          { status: 409 },
        );
      }
    }

    if (!allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          message: `Cannot cancel booking with status: ${booking.status}. Contact support.`,
        },
        { status: 400 },
      );
    }

    if (booking.bookingFeeStatus === "applied") {
      return NextResponse.json(
        {
          message:
            "Booking fee has already been released to provider and cannot be auto-refunded on cancellation.",
        },
        { status: 409 },
      );
    }

    const seekerSameDayCancellation =
      !isProvider &&
      pickupSlotTime !== null &&
      isSameCalendarDay(now, pickupSlotTime);

    const shouldAttemptRefund =
      booking.bookingFeeStatus === "paid" &&
      (isProvider || !seekerSameDayCancellation);
    const shouldForfeitFee =
      booking.bookingFeeStatus === "paid" &&
      !isProvider &&
      seekerSameDayCancellation;

    let refundId: string | null = null;
    let shouldMarkRefunded = false;
    if (shouldAttemptRefund) {
      if (!booking.razorpay_payment_id) {
        return NextResponse.json(
          {
            message:
              "Cannot cancel with refund: payment reference missing. Please contact support.",
          },
          { status: 409 },
        );
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
        }
      );

      if (lockResult.modifiedCount === 0) {
        const latest = await db.collection("bookings").findOne({ _id: booking_id });
        if (latest?.status === "cancelled") {
          return NextResponse.json({
            success: true,
            message: "Booking already cancelled",
            idempotent: true,
          });
        }
        if (latest?.refund_in_progress_at) {
          const lockAt = new Date(latest.refund_in_progress_at);
          const lockIsFresh =
            !Number.isNaN(lockAt.getTime()) &&
            Date.now() - lockAt.getTime() < REFUND_LOCK_TIMEOUT_MS;
          if (lockIsFresh) {
            return NextResponse.json(
              { message: "Refund is already in progress for this booking." },
              { status: 409 }
            );
          }
        }
        return NextResponse.json(
          { message: "Booking status changed. Please refresh and retry." },
          { status: 409 }
        );
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
          }
        );

        logger.error("BOOKINGS", "Failed to refund booking fee on cancel", error, {
          bookingId: id,
          cancelledBy,
        });
        return NextResponse.json(
          {
            message:
              "Refund could not be processed right now, so booking was not cancelled. Please retry.",
          },
          { status: 502 },
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
          ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}),
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
      return NextResponse.json({
        success: true,
        message: shouldMarkRefunded
          ? "Booking cancelled and booking fee refunded"
          : shouldForfeitFee
            ? "Booking cancelled. Same-day cancellation is non-refundable."
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
        }
      );
    } else if (shouldForfeitFee && latest?.bookingFeeStatus === "paid") {
      await db.collection("bookings").updateOne(
        { _id: booking_id, bookingFeeStatus: "paid" },
        {
          $set: {
            bookingFeeStatus: "forfeited",
            updatedAt: now,
          },
        }
      );
    } else if (shouldMarkRefunded || latest?.refund_in_progress_at) {
      await db.collection("bookings").updateOne(
        { _id: booking_id },
        {
          $unset: { refund_in_progress_at: "" },
          $set: { updatedAt: now },
        }
      );
    }

    const latestAfter = await db.collection("bookings").findOne({ _id: booking_id });
    if (latestAfter?.status === "cancelled") {
      return NextResponse.json({
        success: true,
        message: "Booking already cancelled",
        idempotent: true,
      });
    }

    return NextResponse.json(
      {
        message: shouldMarkRefunded
          ? "Booking status changed. Refund has been processed; please refresh and retry."
          : shouldForfeitFee
            ? "Booking status changed. Same-day cancellation is non-refundable; please refresh and retry."
          : "Booking status changed. Please refresh and retry.",
      },
      { status: 409 },
    );
  } catch (error) {
    logger.error("BOOKINGS", "Error cancelling booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
