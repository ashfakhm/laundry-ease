import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, updateOrderPaymentStatus } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";

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

    const order_id = new ObjectId(id);
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

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error) {
    console.error("Error creating payment order:", error);
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

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    // Update DB
    const success = await updateOrderPaymentStatus(new ObjectId(id), "paid");

    if (success) {
      return NextResponse.json({ message: "Payment successful" });
    } else {
      return NextResponse.json(
        { message: "Failed to update order status" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
