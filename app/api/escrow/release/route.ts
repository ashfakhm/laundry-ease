import { NextRequest, NextResponse } from "next/server";
import { getHeldOrdersPastEscrowDate, releaseEscrowPayment } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { Order } from "@/types/orders";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  // Verify Cron Secret - This endpoint should only be called by cron jobs
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    logger.error(
      "ESCROW",
      "CRON_SECRET not configured - escrow release endpoint disabled"
    );
    return NextResponse.json(
      { error: "Endpoint not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
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
      // Note: releaseEscrowPayment already checks for complaints internally
      // Double-check here for logging purposes only
      const activeComplaint = await db.collection("complaints").findOne({
        order_id: new ObjectId(order._id),
        status: { $in: ["open", "investigating", "escalated", "in_progress"] },
      });

      if (activeComplaint) {
        // Escrow release skipped due to active complaint - expected behavior
        logger.info("ESCROW", "Skipping escrow release due to active complaint", { orderId: order._id, complaintId: activeComplaint._id });
        continue;
      }
      
      // releaseEscrowPayment is idempotent - safe to call multiple times
      const success = await releaseEscrowPayment(order._id);
      if (success) {
        releasedOrders.push(order);
        logger.info("ESCROW", "Escrow released successfully", { orderId: order._id });
      } else {
        // Could be already released (idempotent) or blocked by complaint
        failedOrders.push(order);
        logger.warn("ESCROW", "Escrow release failed", { orderId: order._id });
      }
    }

    return NextResponse.json({
      message: "Escrow release job completed",
      releasedOrders,
      failedOrders,
    });
  } catch (error) {
    logger.error("ESCROW", "Error releasing escrow payments", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
