import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { orderScheduleDeliverySchema } from "@/lib/api/schemas";

// POST /api/orders/[id]/schedule-delivery
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let action: string | undefined;
  try {
    const body = await req.json();
    const parsed = orderScheduleDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid schedule data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const parsedData = parsed.data;
    action = parsedData.action;
    const { dateTime } = parsedData;

    const { db } = await getDb();
    const order = await db
      .collection<Order>("orders")
      .findOne({ _id: new ObjectId(id) });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (action === "propose") {
      if (!dateTime)
        return NextResponse.json({ error: "Date required" }, { status: 400 });

      await db.collection<Order>("orders").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            deliverySlot: {
              proposedBy: "provider",
              dateTime: new Date(dateTime),
              proposedAt: new Date(),
            },
            process_status: "ready", // Assuming proposing delivery means it's ready
          },
        }
      );
      return NextResponse.json({ success: true, message: "Delivery proposed" });
    } else if (action === "confirm") {
      if (!order.deliverySlot)
        return NextResponse.json(
          { error: "No slot proposed" },
          { status: 400 }
        );

      await db.collection<Order>("orders").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            "deliverySlot.confirmedAt": new Date(),
            process_status: "out_for_delivery", // Or waiting for pickup, but strict flow usually moves to out_for_delivery on confirmation or actual dispatch
          },
        }
      );
      return NextResponse.json({
        success: true,
        message: "Delivery confirmed",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    logger.error("ORDERS", "Scheduling error", error, { orderId: id, action });
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
