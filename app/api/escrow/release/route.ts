import { NextRequest, NextResponse } from "next/server";
import { getHeldOrdersPastEscrowDate, releaseEscrowPayment } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { Order } from "@/types/orders";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  // Verify Cron Secret - This endpoint should only be called by cron jobs
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    console.error(
      "CRON_SECRET not configured - escrow release endpoint disabled"
    );
    return NextResponse.json(
      { error: "Endpoint not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ordersToRelease = await getHeldOrdersPastEscrowDate();

    if (ordersToRelease.length === 0) {
      return NextResponse.json({ message: "No orders to release" });
    }

    const releasedOrders: Order[] = [];
    const failedOrders: Order[] = [];

    const { db } = await getDb();

    for (const order of ordersToRelease) {
      // Check for open complaints before releasing payment
      const activeComplaint = await db.collection("complaints").findOne({
        order_id: new ObjectId(order._id),
        status: { $in: ["open", "investigating", "escalated"] },
      });

      if (activeComplaint) {
        console.log(
          `Escrow release skipped for order ${order._id} due to active complaint`
        );
        continue;
      }
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
