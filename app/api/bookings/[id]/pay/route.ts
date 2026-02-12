import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getBookingById } from "@/lib/db/index";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

function appErrorResponse(error: AppError) {
  return NextResponse.json(
    {
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.statusCode },
  );
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

    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let booking_id: ObjectId;
    try {
      booking_id = new ObjectId(id);
    } catch {
      return NextResponse.json(
        { message: "Invalid booking id" },
        { status: 400 },
      );
    }
    const booking = await getBookingById(booking_id);

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 },
      );
    }

    if (booking.seeker_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    if (booking.status !== "requested") {
      return NextResponse.json(
        {
          message:
            "Booking fee can only be paid while booking is waiting for provider response.",
        },
        { status: 409 },
      );
    }

    if (
      booking.bookingFeeStatus === "paid" ||
      booking.bookingFeeStatus === "applied"
    ) {
      return NextResponse.json(
        { message: "Booking fee already paid" },
        { status: 400 },
      );
    }

    if (
      booking.bookingFeeStatus === "refunded" ||
      booking.bookingFeeStatus === "forfeited"
    ) {
      return NextResponse.json(
        {
          message:
            "Booking fee payment is not allowed for refunded or forfeited bookings.",
        },
        { status: 409 },
      );
    }

    if (!booking.bookingFee || booking.bookingFee <= 0) {
      return NextResponse.json(
        { message: "Invalid booking fee amount" },
        { status: 400 },
      );
    }

    const amount = Math.round(booking.bookingFee * 100);
    if (amount <= 0) {
      return NextResponse.json(
        { message: "Invalid booking fee amount" },
        { status: 400 },
      );
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
      return appErrorResponse(error);
    }

    logger.error("BOOKINGS", "Error creating booking fee order", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
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

    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let booking_id: ObjectId;
    try {
      booking_id = new ObjectId(id);
    } catch {
      return NextResponse.json(
        { message: "Invalid booking id" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        { message: "Missing payment fields" },
        { status: 400 },
      );
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid signature" },
        { status: 400 },
      );
    }

    const { db } = await getDb();
    const booking = await db.collection<Booking>("bookings").findOne({
      _id: booking_id,
      seeker_id: new ObjectId(session.user.id),
    });

    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 },
      );
    }

    if (
      (booking.bookingFeeStatus === "paid" ||
        booking.bookingFeeStatus === "applied") &&
      booking.razorpay_payment_id === razorpay_payment_id
    ) {
      return NextResponse.json({
        message: "Payment successful",
        idempotent: true,
      });
    }

    if (booking.status !== "requested") {
      return NextResponse.json(
        {
          message:
            "Booking fee cannot be captured because booking is no longer pending provider response.",
        },
        { status: 409 },
      );
    }

    if (
      !booking.razorpay_order_id ||
      booking.razorpay_order_id !== razorpay_order_id
    ) {
      return NextResponse.json(
        { message: "Razorpay order mismatch" },
        { status: 400 },
      );
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
      return NextResponse.json({ message: "Payment successful" });
    } else {
      return NextResponse.json(
        { message: "Failed to update booking status" },
        { status: 409 },
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorResponse(error);
    }

    logger.error("BOOKINGS", "Error verifying booking fee", error, {
      bookingId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
