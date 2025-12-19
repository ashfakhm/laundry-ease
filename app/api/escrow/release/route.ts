import { NextResponse } from "next/server";
import { getHeldOrdersPastEscrowDate, releaseEscrowPayment } from "@/lib/db";
import { Order } from "@/types/orders";

export async function POST(req: Request) {
  try {
    const ordersToRelease = await getHeldOrdersPastEscrowDate();

    if (ordersToRelease.length === 0) {
      return NextResponse.json({ message: "No orders to release" });
    }

    const releasedOrders: Order[] = [];
    const failedOrders: Order[] = [];

    for (const order of ordersToRelease) {
      // TODO: Check for open complaints before releasing payment
      const success = await releaseEscrowPayment(order._id);
      if (success) {
        releasedOrders.push(order);
      } else {
        failedOrders.push(order);
      }
    }

    return NextResponse.json({
      message: "Escrow release job completed",
      releasedOrders,
      failedOrders,
    });
  } catch (error) {
    console.error("Error releasing escrow payments:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
