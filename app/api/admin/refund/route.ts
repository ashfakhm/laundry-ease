import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { adminRefundSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import type { Order } from "@/types/orders";
import type { Booking } from "@/types/bookings";

function toPaise(amountRupees: number) {
  return Math.round(amountRupees * 100);
}

function buildRefundNotes(reason: string | undefined, context: Record<string, string>) {
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
      windowMs: 5 * 60 * 1000,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = adminRefundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid refund data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const parsedData = parsed.data;
    paymentId = parsedData.paymentId;
    bookingId = parsedData.bookingId;
    orderId = parsedData.orderId;
    const { amount, reason } = parsedData;

    if (!bookingId && !orderId) {
      return NextResponse.json(
        { error: "Either bookingId or orderId is required" },
        { status: 400 },
      );
    }

    if (bookingId && orderId) {
      return NextResponse.json(
        { error: "Provide only one target: bookingId or orderId" },
        { status: 400 },
      );
    }

    const { db } = await getDb();

    if (orderId) {
      if (!ObjectId.isValid(orderId)) {
        return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
      }

      const orderObjectId = new ObjectId(orderId);
      const order = await db.collection<Order>("orders").findOne({
        _id: orderObjectId,
      });
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (!order.razorpay_payment_id || order.razorpay_payment_id !== paymentId) {
        return NextResponse.json(
          { error: "Payment ID does not match this order" },
          { status: 409 },
        );
      }

      if (order.payment_status === "refunded") {
        return NextResponse.json({
          success: true,
          idempotent: true,
          message: "Order is already refunded",
        });
      }

      if (!["paid", "held", "released"].includes(order.payment_status)) {
        return NextResponse.json(
          { error: "Order payment is not in a refundable state" },
          { status: 409 },
        );
      }

      if (order.payout_id && order.payout_status !== "failed") {
        return NextResponse.json(
          {
            error:
              "Cannot auto-refund after payout has started. Resolve manually with provider recovery.",
          },
          { status: 409 },
        );
      }

      const refundAmountRupees =
        typeof amount === "number" ? amount : Number(order.total_price || 0);
      if (!Number.isFinite(refundAmountRupees) || refundAmountRupees <= 0) {
        return NextResponse.json(
          { error: "Invalid refund amount" },
          { status: 400 },
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

      return NextResponse.json({ success: true, refund });
    }

    if (!ObjectId.isValid(bookingId!)) {
      return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });
    }

    const bookingObjectId = new ObjectId(bookingId!);
    const booking = await db.collection<Booking>("bookings").findOne({
      _id: bookingObjectId,
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (!booking.razorpay_payment_id || booking.razorpay_payment_id !== paymentId) {
      return NextResponse.json(
        { error: "Payment ID does not match this booking" },
        { status: 409 },
      );
    }

    if (booking.bookingFeeStatus === "refunded") {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: "Booking fee is already refunded",
      });
    }

    if (booking.bookingFeeStatus === "applied") {
      return NextResponse.json(
        {
          error:
            "Booking fee was already released to provider and cannot be auto-refunded.",
        },
        { status: 409 },
      );
    }

    if (booking.bookingFeeStatus !== "paid") {
      return NextResponse.json(
        { error: "Booking fee is not in a refundable state" },
        { status: 409 },
      );
    }

    const refundAmountRupees =
      typeof amount === "number" ? amount : Number(booking.bookingFee || 0);
    if (!Number.isFinite(refundAmountRupees) || refundAmountRupees <= 0) {
      return NextResponse.json(
        { error: "Invalid refund amount" },
        { status: 400 },
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

    return NextResponse.json({ success: true, refund });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ADMIN_REFUND", "Refund error", error, {
      paymentId,
      bookingId,
      orderId,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
