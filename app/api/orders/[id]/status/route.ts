import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { Order } from "@/types/orders";

// POST: Update Order Process Status
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

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.provider_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;

    const validStatuses = [
      "processing",
      "washing",
      "ironing",
      "ready",
      "out_for_delivery",
      "delivered",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const { db } = await getDb();

    // Logic for Penalty Calculation when marking 'delivered' (or 'ready' if that stops the clock)
    // PRD: "If delivery exceeds the deadline... penalty... applied"
    // Usually penalty is finalized at 'delivered' or 'out_for_delivery'?
    // Let's calculate it when status becomes "delivered".

    type ProcessStatus = Order["process_status"];
    const updateData: { process_status: ProcessStatus; latePenalty?: number } =
      {
        process_status: status as ProcessStatus,
      };

    if (status === "delivered" && order.deadline) {
      const now = new Date();
      if (now > order.deadline) {
        // Calculate Penalty
        // Rule: 5% discount per hour late (max 30%)
        const lateHours =
          (now.getTime() - new Date(order.deadline).getTime()) /
          (1000 * 60 * 60);
        const penaltyRate = Math.min(lateHours * 0.05, 0.3);
        const penaltyAmount = Math.round(order.total_price * penaltyRate);

        updateData.latePenalty = penaltyAmount;
        // Note: total_price is NOT reduced in DB usually to keep record of original price,
        // but the *payable* amount is reduced.
        // However, for simplicity here, we might just store the penalty.
      }
    }

    await db
      .collection<Order>("orders")
      .updateOne({ _id: order_id }, { $set: updateData });

    return NextResponse.json({
      message: "Status updated",
      latePenalty: updateData.latePenalty,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
