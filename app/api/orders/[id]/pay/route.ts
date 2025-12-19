import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, updateOrderPaymentStatus } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const order_id = new ObjectId(params.id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      );
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

    // TODO: Integrate with Stripe for actual payment processing
    const success = await updateOrderPaymentStatus(order_id, "paid");

    if (success) {
      return NextResponse.json({ message: "Payment successful" });
    } else {
      return NextResponse.json(
        { message: "Failed to process payment" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
