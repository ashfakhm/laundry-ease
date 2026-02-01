import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// POST: Create Razorpay Order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    const orderId = new ObjectId(id);

    const order = await db.collection("orders").findOne({ _id: orderId });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.seeker_id.toString() !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (order.payment_status === "paid" || order.payment_status === "held") {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 400 },
      );
    }

    // Calculate Amount
    // Total Price + Delivery Charge (if any) - already in order.total_price ideally,
    // but strict type might separate them. Let's sum safely.
    // Order Type says: total_price is the final amount.
    // Let's verify: `total_price` should be the amount to pay.
    const amountToPay = order.total_price + (order.delivery_charge || 0);
    const amountInPaise = Math.round(amountToPay * 100);

    const razorpayOrder = await createRazorpayOrder(amountInPaise, id);

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID, // Send public key to client
    });
  } catch (error) {
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
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const { db } = await getDb();
    const orderId = new ObjectId(id);

    // Update Order Status
    await db.collection("orders").updateOne(
      { _id: orderId },
      {
        $set: {
          payment_status: "paid",
          payment_made_at: new Date(),
          process_status: "processing", // Move to processing
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("ORDERS", "Payment verification error", error, {
      orderId: id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
