import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createRazorpayOrder } from "@/lib/razorpay";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const { db } = await getDb();
    const order = await db
      .collection<Order>("orders")
      .findOne({
        _id: orderId,
        seeker_id: new ObjectId(session.user.id),
      });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status !== "unpaid") {
      return NextResponse.json(
        { error: "Order is already paid or processing" },
        { status: 400 }
      );
    }

    // Amount in paise
    const amountInPaise = Math.round(order.total_price * 100);
    if (amountInPaise <= 0) {
      return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
    }

    const razorpayOrder = await createRazorpayOrder(
      amountInPaise,
      order._id.toString()
    );

    // Update order with razorpay order id
    await db
      .collection<Order>("orders")
      .updateOne(
        { _id: orderId },
        { $set: { razorpay_order_id: razorpayOrder.id } }
      );

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("ORDERS", "Error initiating order payment", error, {
      orderId: id,
    });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
