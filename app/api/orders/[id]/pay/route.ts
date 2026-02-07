import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { getDb } from "@/lib/mongodb";

// POST: Create Razorpay Order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let order_id: ObjectId;
    try {
      order_id = new ObjectId(id);
    } catch {
      return NextResponse.json({ message: "Invalid order id" }, { status: 400 });
    }
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.seeker_id.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "You are not authorized to pay for this order" },
        { status: 403 }
      );
    }

    if (order.payment_status !== "unpaid") {
      return NextResponse.json(
        { message: "Order has already been paid" },
        { status: 400 }
      );
    }

    // Convert total_price to paise (multiply by 100)
    // Assuming total_price is in Rupees
    const amount = Math.round(order.total_price * 100);

    const razorpayOrder = await createRazorpayOrder(amount, id);
    const { db } = await getDb();
    await db.collection("orders").updateOne(
      { _id: order_id },
      { $set: { razorpay_order_id: razorpayOrder.id, updatedAt: new Date() } },
    );

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    logger.error("ORDERS", "Error creating payment order", error, { orderId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Verify Payment and Update Status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; 
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        { message: "Missing payment fields" },
        { status: 400 }
      );
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    let order_id: ObjectId;
    try {
      order_id = new ObjectId(id);
    } catch {
      return NextResponse.json({ message: "Invalid order id" }, { status: 400 });
    }
    const order = await getOrderById(order_id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.seeker_id.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "You are not authorized to pay for this order" },
        { status: 403 }
      );
    }

    if (
      (order.payment_status === "paid" ||
        order.payment_status === "held" ||
        order.payment_status === "released") &&
      order.razorpay_payment_id === razorpay_payment_id
    ) {
      return NextResponse.json({ message: "Payment successful", idempotent: true });
    }

    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json({ message: "Razorpay order mismatch" }, { status: 400 });
    }

    // Update DB
    const { db } = await getDb();
    const res = await db.collection("orders").updateOne(
      { _id: order_id, payment_status: "unpaid" },
      {
        $set: {
          payment_status: "paid",
          payment_made_at: new Date(),
          razorpay_payment_id,
          updatedAt: new Date(),
        },
      }
    );

    if (res.modifiedCount > 0) {
      return NextResponse.json({ message: "Payment successful" });
    } else {
      return NextResponse.json(
        { message: "Failed to update order status" },
        { status: 409 }
      );
    }
  } catch (error) {
    logger.error("ORDERS", "Error verifying payment", error, { orderId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
