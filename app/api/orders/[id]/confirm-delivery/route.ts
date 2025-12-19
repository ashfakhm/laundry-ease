import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, confirmDelivery } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json({ message: "OTP is required" }, { status: 400 });
    }

    // TODO: Implement actual OTP validation
    if (otp !== "123456") {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.provider_id.toString() !== session.user.id) {
      return NextResponse.json(
        {
          message: "You are not authorized to confirm delivery for this order",
        },
        { status: 403 }
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { message: "Order must be paid before confirming delivery" },
        { status: 400 }
      );
    }

    const success = await confirmDelivery(order_id);

    if (success) {
      return NextResponse.json({
        message: "Delivery confirmed, escrow started",
      });
    } else {
      return NextResponse.json(
        { message: "Failed to confirm delivery" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error confirming delivery:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
