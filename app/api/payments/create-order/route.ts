import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  try {
    // Require authentication for creating payment orders
    await requireAuth();

    const { bookingId, amount, currency } = await req.json();
    if (!bookingId || !amount || !currency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate amount is positive number
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Validate currency
    const validCurrencies = ["INR"];
    if (!validCurrencies.includes(currency)) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: bookingId,
      payment_capture: true,
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    logger.error("PAYMENTS", "Razorpay order creation error", error);
    return NextResponse.json(
      { error: "Payment temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
}
