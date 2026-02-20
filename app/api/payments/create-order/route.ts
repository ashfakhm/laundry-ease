import {
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { getDb } from "@/lib/mongodb";
import { bookingPaymentInitSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "payments:create-order",
      max: 8,
      windowMs: 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(user.id)) {
      return legacyErrorResponse("Unauthorized", 401);
    }

    const payload = await req.json();
    const parsed = bookingPaymentInitSchema.safeParse(payload);
    if (!parsed.success) {
      return legacyErrorResponse(
        "Invalid booking payment request",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const bookingId = new ObjectId(parsed.data.bookingId);
    const seekerId = new ObjectId(user.id);
    const { db } = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: bookingId,
      seeker_id: seekerId,
    });

    if (!booking) {
      return legacyErrorResponse("Booking not found", 404);
    }

    if (booking.status !== "requested") {
      return legacyErrorResponse(
        "Booking fee can only be paid while booking is waiting for provider response.",
        409,
      );
    }

    if (
      booking.bookingFeeStatus === "paid" ||
      booking.bookingFeeStatus === "applied"
    ) {
      return legacyErrorResponse("Booking fee already paid", 409);
    }

    if (
      booking.bookingFeeStatus === "refunded" ||
      booking.bookingFeeStatus === "forfeited"
    ) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message:
            "Booking fee payment is not allowed for refunded or forfeited bookings.",
          error: {
            code: "ERROR",
            message:
              "Booking fee payment is not allowed for refunded or forfeited bookings.",
          },
        },
        { status: 409 },
      );
    }

    const bookingFee = Number(booking.bookingFee || 0);
    const amount = Math.round(bookingFee * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          message: "Invalid booking fee amount",
          error: { code: "ERROR", message: "Invalid booking fee amount" },
        },
        { status: 400 },
      );
    }

    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: bookingId.toString(),
      payment_capture: true,
    });

    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          razorpay_order_id: order.id,
          updatedAt: new Date(),
        },
      },
    );

    return legacySuccessResponse({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("PAYMENTS", "Razorpay order creation error", error);
    return legacyErrorResponse(
      "Payment temporarily unavailable. Please try again later.",
      500,
    );
  }
}
