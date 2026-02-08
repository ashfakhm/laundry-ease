import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db";
import { Role } from "@/types/enums";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

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

    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    // Get provider by email
    const provider = await db
      .collection("providers")
      .findOne({ email: session.user.email });

    if (!provider) {
      return NextResponse.json(
        { message: "Provider not found" },
        { status: 404 }
      );
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

    if (booking.provider_id.toString() !== provider._id.toString()) {
      return NextResponse.json(
        { message: "You are not authorized to reject this booking" },
        { status: 403 }
      );
    }

    if (booking.status !== "requested") {
      if (booking.status === "rejected") {
        return NextResponse.json({
          message: "Booking already rejected",
          idempotent: true,
        });
      }

      return NextResponse.json(
        { message: "Booking has already been acted upon" },
        { status: 400 }
      );
    }

    if (booking.bookingFeeStatus !== "paid") {
      return NextResponse.json(
        { message: "Booking fee must be paid before provider can reject" },
        { status: 400 }
      );
    }

    if (!booking.razorpay_payment_id) {
      return NextResponse.json(
        {
          message:
            "Cannot reject booking: payment reference missing for booking-fee refund.",
        },
        { status: 409 }
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
        return NextResponse.json({
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
          return NextResponse.json(
            { message: "Refund is already in progress for this booking." },
            { status: 409 }
          );
        }
      }
      return NextResponse.json(
        { message: "Booking status changed during rejection. Please refresh." },
        { status: 409 }
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
      return NextResponse.json(
        {
          message:
            "Failed to refund booking fee. Booking was not rejected. Please retry.",
        },
        { status: 502 }
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
        return NextResponse.json({
          message: "Booking already rejected",
          idempotent: true,
        });
      }

      return NextResponse.json(
        {
          message:
            "Booking status changed during rejection. Refund has been processed; please refresh.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Booking rejected and fee refunded" });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("BOOKINGS", "Error rejecting booking", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
