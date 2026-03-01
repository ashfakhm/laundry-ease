import { ObjectId } from "mongodb";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { adminRefundSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { successResponse, errorResponse } from "@/lib/api/response";
import type { Order } from "@/types/orders";
import type { Booking } from "@/types/bookings";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { toPaise } from "@/lib/utils/monetary";

function buildRefundNotes(
  reason: string | undefined,
  context: Record<string, string>,
) {
  return {
    ...(reason ? { reason } : {}),
    ...context,
  };
}

export async function POST(req: Request) {
  let paymentId: string | undefined;
  let bookingId: string | undefined;
  let orderId: string | undefined;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:refund",
      max: 30,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const session = await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminRefundSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid refund data",
        parsed.error.flatten().fieldErrors,
      );
    }

    const parsedData = parsed.data;
    paymentId = parsedData.paymentId;
    bookingId = parsedData.bookingId;
    orderId = parsedData.orderId;
    const { amount, reason } = parsedData;

    if (!bookingId && !orderId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Either bookingId or orderId is required",
      );
    }

    if (bookingId && orderId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Provide only one target: bookingId or orderId",
      );
    }

    const { db } = await getDb();

    if (orderId) {
      if (!ObjectId.isValid(orderId)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid orderId");
      }

      const orderObjectId = new ObjectId(orderId);
      const order = await db.collection<Order>("orders").findOne({
        _id: orderObjectId,
      });
      if (!order) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, "Order not found");
      }

      if (
        !order.razorpay_payment_id ||
        order.razorpay_payment_id !== paymentId
      ) {
        throw new AppError(
          ErrorCode.CONFLICT,
          409,
          "Payment ID does not match this order",
        );
      }

      if (order.payment_status === "refunded") {
        return successResponse({
          idempotent: true,
          message: "Order is already refunded",
        });
      }

      if (!["paid", "held", "released"].includes(order.payment_status)) {
        throw new AppError(
          ErrorCode.CONFLICT,
          409,
          "Order payment is not in a refundable state",
        );
      }

      if (order.payout_id && order.payout_status !== "failed") {
        throw new AppError(
          ErrorCode.CONFLICT,
          409,
          "Cannot auto-refund after payout has started. Resolve manually with provider recovery.",
        );
      }

      const refundAmountRupees =
        typeof amount === "number" ? amount : Number(order.total_price || 0);
      if (!Number.isFinite(refundAmountRupees) || refundAmountRupees <= 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid refund amount",
        );
      }

      const refund = await refundRazorpayPayment(
        paymentId,
        toPaise(refundAmountRupees),
        buildRefundNotes(reason, {
          source: "admin_refund_route",
          order_id: orderId,
        }),
      );

      await db.collection<Order>("orders").updateOne(
        { _id: orderObjectId },
        {
          $set: {
            payment_status: "refunded",
            refund_reason: reason || "Admin refund",
            refund_amount: refundAmountRupees,
            refund_at: new Date(),
            updatedAt: new Date(),
            ...(refund.id ? { razorpay_refund_id: refund.id } : {}),
          },
          $unset: {
            payout_lock_at: "",
          },
        },
      );

      await db.collection("admin_logs").insertOne({
        admin: session.user.email || null,
        action: "refund",
        orderId,
        paymentId,
        amount: refundAmountRupees,
        reason: reason || "Admin refund",
        at: new Date(),
      });

      return successResponse({ refund });
    }

    if (!ObjectId.isValid(bookingId!)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid bookingId");
    }

    const bookingObjectId = new ObjectId(bookingId!);
    const booking = await db.collection<Booking>("bookings").findOne({
      _id: bookingObjectId,
    });
    if (!booking) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Booking not found");
    }

    if (
      !booking.razorpay_payment_id ||
      booking.razorpay_payment_id !== paymentId
    ) {
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        "Payment ID does not match this booking",
      );
    }

    if (booking.bookingFeeStatus === "refunded") {
      return successResponse({
        idempotent: true,
        message: "Booking fee is already refunded",
      });
    }

    if (booking.bookingFeeStatus === "applied") {
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        "Booking fee was already released to provider and cannot be auto-refunded.",
      );
    }

    if (booking.bookingFeeStatus !== "paid") {
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        "Booking fee is not in a refundable state",
      );
    }

    const refundAmountRupees =
      typeof amount === "number" ? amount : Number(booking.bookingFee || 0);
    if (!Number.isFinite(refundAmountRupees) || refundAmountRupees <= 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid refund amount",
      );
    }

    const refund = await refundRazorpayPayment(
      paymentId,
      toPaise(refundAmountRupees),
      buildRefundNotes(reason, {
        source: "admin_refund_route",
        booking_id: bookingId!,
      }),
    );

    await db.collection<Booking>("bookings").updateOne(
      { _id: bookingObjectId },
      {
        $set: {
          bookingFeeStatus: "refunded",
          refundProcessedAt: new Date(),
          updatedAt: new Date(),
          ...(refund.id ? { booking_fee_refund_id: refund.id } : {}),
        },
        $unset: {
          refund_in_progress_at: "",
        },
      },
    );

    await db.collection("admin_logs").insertOne({
      admin: session.user.email || null,
      action: "refund",
      bookingId,
      paymentId,
      amount: refundAmountRupees,
      reason: reason || "Admin booking-fee refund",
      at: new Date(),
    });

    return successResponse({ refund });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ADMIN_REFUND", "Refund error", error, {
      paymentId,
      bookingId,
      orderId,
    });

    return errorResponse(error);
  }
}
