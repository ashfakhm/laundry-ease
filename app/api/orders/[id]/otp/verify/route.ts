import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, confirmDelivery } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

// POST: Provider verifies delivery OTP and marks delivery confirmed
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid OTP",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.provider_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return NextResponse.json(
        {
          message: "OTP can only be verified when order is out for delivery",
          currentStatus: order.process_status || "invoiced",
        },
        { status: 409 }
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { message: "Order must be paid before confirming delivery" },
        { status: 400 }
      );
    }

    const { otp } = parsed.data;

    // Verify OTP exactly as stored on the order
    if (!order.delivery_otp || order.delivery_otp !== otp) {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
    }

    const success = await confirmDelivery(order_id);
    if (!success) {
      return NextResponse.json(
        { message: "Failed to confirm delivery" },
        { status: 500 }
      );
    }

    logger.info("ORDERS", "Delivery OTP verified by provider", {
      orderId: id,
      providerId: session.user.id,
    });

    return NextResponse.json({
      message: "Delivery confirmed",
    });
  } catch (error) {
    logger.error("ORDERS", "Error verifying delivery OTP", error, {
      orderId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
