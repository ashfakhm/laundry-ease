import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, cancelOrder } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

const CANCELLATION_FEE = 1000; // 10 currency units

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        { message: "You are not authorized to cancel this order" },
        { status: 403 }
      );
    }

    if (order.payment_status !== "unpaid") {
      return NextResponse.json(
        { message: "Cannot cancel an order that has been paid" },
        { status: 400 }
      );
    }

    if (order.cancellation_status) {
      return NextResponse.json(
        { message: "Order has already been cancelled" },
        { status: 400 }
      );
    }

    const success = await cancelOrder(
      order_id,
      new ObjectId(session.user.id),
      CANCELLATION_FEE
    );

    if (success) {
      return NextResponse.json({ message: "Order cancelled successfully" });
    } else {
      return NextResponse.json(
        { message: "Failed to cancel order" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
