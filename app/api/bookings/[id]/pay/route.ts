import { getBookingById } from "@/lib/db/index";
import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
import { ObjectId } from "mongodb";
import { createRazorpayOrder } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { Booking } from "@/types/bookings";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";

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
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id");
    }
    const booking_id = new ObjectId(id);
    const booking = await getBookingById(booking_id);

    if (!booking) {
      throw new AppError(ErrorCode.BOOKING_NOT_FOUND, 404, "Booking not found");
    }

    if (booking.seeker_id.toString() !== user.id) {
      throw new AppError(ErrorCode.BOOKING_NOT_FOUND, 404, "Booking not found");
    }

    if (booking.status !== "requested") {
      throw new AppError(
        ErrorCode.INVALID_STATE_TRANSITION,
        409,
        "Booking fee can only be paid while booking is waiting for provider response.",
      );
    }

    if (
      booking.bookingFeeStatus === "paid" ||
      booking.bookingFeeStatus === "applied"
    ) {
      throw new AppError(
        ErrorCode.BOOKING_ALREADY_PROCESSED,
        400,
        "Booking fee already paid",
      );
    }

    if (
      booking.bookingFeeStatus === "refunded" ||
      booking.bookingFeeStatus === "forfeited"
    ) {
      throw new AppError(
        ErrorCode.INVALID_STATE_TRANSITION,
        409,
        "Booking fee payment is not allowed for refunded or forfeited bookings.",
      );
    }

    if (!booking.bookingFee || booking.bookingFee <= 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid booking fee amount",
      );
    }

    const amount = Math.round(booking.bookingFee * 100);
    if (amount <= 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid booking fee amount",
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

    return successResponse({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    return errorResponse(error);
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
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking id");
    }
    const booking_id = new ObjectId(id);

    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      throw new AppError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        400,
        "Missing payment fields",
      );
    }

    // Lazy load to avoid circular deps if any, or just standard import fix
    const { verifyRazorpaySignature } = await import("@/lib/razorpay");

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        400,
        "Invalid signature",
      );
    }

    const { db } = await getDb();
    const booking = await db.collection<Booking>("bookings").findOne({
      _id: booking_id,
      seeker_id: new ObjectId(user.id),
    });

    if (!booking) {
      throw new AppError(ErrorCode.BOOKING_NOT_FOUND, 404, "Booking not found");
    }

    if (
      (booking.bookingFeeStatus === "paid" ||
        booking.bookingFeeStatus === "applied") &&
      booking.razorpay_payment_id === razorpay_payment_id
    ) {
      return successResponse({
        message: "Payment successful",
        idempotent: true,
      });
    }

    if (booking.status !== "requested") {
      throw new AppError(
        ErrorCode.INVALID_STATE_TRANSITION,
        409,
        "Booking fee cannot be captured because booking is no longer pending provider response.",
      );
    }

    if (
      !booking.razorpay_order_id ||
      booking.razorpay_order_id !== razorpay_order_id
    ) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Razorpay order mismatch",
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
      return successResponse({
        message: "Payment successful",
      });
    } else {
      throw new AppError(
        ErrorCode.INVALID_STATE_TRANSITION,
        409,
        "Failed to update booking status",
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
