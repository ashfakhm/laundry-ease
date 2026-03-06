import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
import { createRazorpayOrder } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { getDb } from "@/lib/mongodb";
import { bookingPaymentInitSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { errorResponse, successResponse } from "@/lib/api/response";

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "payments:create-order",
      max: 8,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const payload = await req.json();
    const parsed = bookingPaymentInitSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking payment request", parsed));
    }

    const bookingId = new ObjectId(parsed.data.bookingId);
    const seekerId = new ObjectId(user.id);
    const { db } = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: bookingId,
      seeker_id: seekerId,
    });

    if (!booking) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found"));
    }

    if (booking.status !== "requested") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Booking fee can only be paid while booking is waiting for provider response."));
    }

    if (
      booking.bookingFeeStatus === "paid" ||
      booking.bookingFeeStatus === "applied"
    ) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Booking fee already paid"));
    }

    if (
      booking.bookingFeeStatus === "refunded" ||
      booking.bookingFeeStatus === "forfeited"
    ) {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Booking fee payment is not allowed for refunded or forfeited bookings."));
    }

    const bookingFee = Number(booking.bookingFee || 0);
    const amount = Math.round(bookingFee * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid booking fee amount"));
    }

    const order = await createRazorpayOrder(
      amount,
      bookingId.toString(),
      "INR",
    );

    await db.collection("bookings").updateOne(
      { _id: bookingId },
      {
        $set: {
          razorpay_order_id: order.id,
          updatedAt: new Date(),
        },
      },
    );

    return successResponse({ orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("PAYMENTS", "Razorpay order creation error", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Payment temporarily unavailable. Please try again later."));
  }
}
