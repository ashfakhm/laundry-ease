import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { paymentVerifySchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";

export const runtime = "nodejs";

function appErrorResponse(error: AppError) {
  return NextResponse.json(
    {
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.statusCode },
  );
}

// POST: Create Razorpay Order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:payment:init",
      max: 8,
      windowMs: 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }
    const orderId = new ObjectId(id);

    const { db } = await getDb();
    const order = await db.collection("orders").findOne({
      _id: orderId,
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (
      order.payment_status === "paid" ||
      order.payment_status === "held" ||
      order.payment_status === "released" ||
      order.payment_status === "refunded"
    ) {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 400 },
      );
    }

    const amountInPaise = Math.round(order.total_price * 100);
    if (amountInPaise <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount" },
        { status: 400 },
      );
    }

    const razorpayOrder = await createRazorpayOrder(amountInPaise, id);
    await db.collection("orders").updateOne(
      { _id: orderId },
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
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorResponse(error);
    }

    logger.error("ORDERS", "Payment init error", error, { orderId: id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT: Verify Payment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:payment:verify",
      max: 10,
      windowMs: 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }
    const orderId = new ObjectId(id);

    const body = await req.json();
    const parsed = paymentVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payment verification payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      parsed.data;
    const { db } = await getDb();

    const order = await db.collection("orders").findOne({
      _id: orderId,
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (
      (order.payment_status === "paid" ||
        order.payment_status === "held" ||
        order.payment_status === "released") &&
      order.razorpay_payment_id === razorpay_payment_id
    ) {
      return NextResponse.json({ success: true, idempotent: true });
    }

    if (
      order.payment_status === "paid" ||
      order.payment_status === "held" ||
      order.payment_status === "released"
    ) {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 409 },
      );
    }

    if (
      !order.razorpay_order_id ||
      order.razorpay_order_id !== razorpay_order_id
    ) {
      return NextResponse.json(
        { error: "Razorpay order mismatch" },
        { status: 400 },
      );
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const now = new Date();

    const result = await db.collection("orders").updateOne(
      { _id: orderId, payment_status: "unpaid" },
      {
        $set: {
          payment_status: "paid",
          payment_made_at: now,
          razorpay_payment_id,
          process_status: order.process_status ?? "invoiced",
          updatedAt: now,
        },
      },
    );

    if (result.modifiedCount === 0) {
      const latest = await db.collection("orders").findOne({ _id: orderId });
      if (
        latest?.payment_status &&
        ["paid", "held", "released"].includes(latest.payment_status) &&
        latest.razorpay_payment_id === razorpay_payment_id
      ) {
        return NextResponse.json({ success: true, idempotent: true });
      }
      return NextResponse.json(
        { error: "Order payment state changed. Please refresh and retry." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorResponse(error);
    }

    logger.error("ORDERS", "Payment verification error", error, {
      orderId: id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
