import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRazorpaySignature } from "@/lib/razorpay";
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

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      await req.json();

    if (!id || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const isValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    const { db } = await getDb();
    const order = await db.collection<Order>("orders").findOne({
      _id: orderId,
      seeker_id: new ObjectId(session.user.id),
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Razorpay order mismatch" },
        { status: 400 }
      );
    }

    if (
      (order.payment_status === "paid" ||
        order.payment_status === "held" ||
        order.payment_status === "released") &&
      order.razorpay_payment_id === razorpayPaymentId
    ) {
      return NextResponse.json({ success: true, message: "Payment verified" });
    }

    // Update order payment status
    // Mark as 'paid'. Logic moves to 'held' when delivery is confirmed.
    const updateRes = await db.collection<Order>("orders").updateOne(
      { _id: orderId, payment_status: "unpaid" },
      {
        $set: {
          payment_status: "paid",
          razorpay_payment_id: razorpayPaymentId,
          payment_made_at: new Date(),
        },
      }
    );

    if (updateRes.modifiedCount === 0) {
      return NextResponse.json({ error: "Order update failed" }, { status: 409 });
    }

    return NextResponse.json({ success: true, message: "Payment verified" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("ORDERS", "Error verifying order payment", error, {
      orderId: id,
    });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
