import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, confirmDelivery } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { confirmDeliverySchema } from "@/lib/api/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();

    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = confirmDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid OTP data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { otp } = parsed.data;

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.seeker_id.toString() !== session.user.id) {
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

    // Verify OTP
    if (!order.delivery_otp || order.delivery_otp !== otp) {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
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
    logger.error("ORDERS", "Error confirming delivery", error, { orderId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
