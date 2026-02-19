import { NextResponse } from "next/server";
import { getBookingById } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

function fail(
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return legacyErrorResponse(message, status, details);
}

// POST: Create Razorpay Order for Booking Fee
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:fee:init",
      max: 8,
      windowMs: 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return fail("Invalid booking id", 400);
    }
    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return fail("Booking not found", 404);
    }

    if (booking.seeker_id.toString() !== user.id) {
      return fail("Unauthorized", 403);
    }

    if (booking.status !== "requested") {
      return fail(
        "Booking fee can only be paid while booking is waiting for provider response.",
        409,
      );
    }

    if (
      booking.bookingFeeStatus === "paid" ||
      booking.bookingFeeStatus === "applied"
    ) {
      return fail("Booking fee already paid", 400);
    }

    if (
      booking.bookingFeeStatus === "refunded" ||
      booking.bookingFeeStatus === "forfeited"
    ) {
      return fail(
        "Booking fee payment is not allowed for refunded or forfeited bookings.",
        409,
      );
    }

    if (!booking.bookingFee || booking.bookingFee <= 0) {
      return fail("Invalid booking fee amount", 400);
    }

    const amount = Math.round(booking.bookingFee * 100);
    if (amount <= 0) {
      return fail("Invalid booking fee amount", 400);
    }

    const razorpayOrder = await createRazorpayOrder(amount, id);

    const { db } = await getDb();
    await db.collection<Booking>("bookings").updateOne(
      { _id: booking_id },
      {
        $set: {
          razorpay_order_id: razorpayOrder.id,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("BOOKINGS", "Error creating booking fee order", error, {
      bookingId: id,
    });
    return fail("Internal server error", 500);
  }
}

// PUT: Verify Payment and Update Booking Status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:fee:verify",
      max: 10,
      windowMs: 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return fail("Invalid booking id", 400);
    }
    const booking_id = new ObjectId(id);

    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return fail("Missing payment fields", 400);
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return fail("Invalid signature", 400);
    }

    const { db } = await getDb();
    const booking = await db.collection<Booking>("bookings").findOne({
      _id: booking_id,
      seeker_id: new ObjectId(user.id),
    });

    if (!booking) {
      return fail("Booking not found", 404);
    }

    if (
      (booking.bookingFeeStatus === "paid" ||
        booking.bookingFeeStatus === "applied") &&
      booking.razorpay_payment_id === razorpay_payment_id
    ) {
      return legacySuccessResponse({
        message: "Payment successful",
        error: null,
        idempotent: true,
      });
    }

    if (booking.status !== "requested") {
      return fail(
        "Booking fee cannot be captured because booking is no longer pending provider response.",
        409,
      );
    }

    if (
      !booking.razorpay_order_id ||
      booking.razorpay_order_id !== razorpay_order_id
    ) {
      return fail("Razorpay order mismatch", 400);
    }

    const res = await db.collection<Booking>("bookings").updateOne(
      {
        _id: booking_id,
        status: "requested",
        $or: [
          { bookingFeeStatus: "pending" },
          { bookingFeeStatus: { $exists: false } },
        ],
      },
      {
        $set: {
          bookingFeeStatus: "paid",
          razorpay_payment_id,
          updatedAt: new Date(),
        },
      },
    );

    if (res.modifiedCount > 0) {
      return legacySuccessResponse({
        message: "Payment successful",
        error: null,
      });
    } else {
      return fail("Failed to update booking status", 409);
    }
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("BOOKINGS", "Error verifying booking fee", error, {
      bookingId: id,
    });
    return fail("Internal server error", 500);
  }
}
