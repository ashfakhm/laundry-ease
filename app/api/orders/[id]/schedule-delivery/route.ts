import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { orderScheduleDeliverySchema } from "@/lib/api/schemas";
import { Role } from "@/types/enums";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";

// POST /api/orders/[id]/schedule-delivery
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let action: string | undefined;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:schedule-delivery",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }
    const orderId = new ObjectId(id);

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
      .findOne({ _id: orderId });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (action === "propose") {
      if (user.role !== Role.PROVIDER) {
        return NextResponse.json(
          { error: "Only providers can propose delivery" },
          { status: 403 }
        );
      }
      if (order.provider_id.toString() !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (!dateTime)
        return NextResponse.json({ error: "Date required" }, { status: 400 });
      if ((order.process_status || "invoiced") !== "ready") {
        return NextResponse.json(
          {
            error:
              "Delivery slots can only be proposed when order is ready for dispatch",
            currentStatus: order.process_status || "invoiced",
          },
          { status: 409 },
        );
      }
      if (order.deliverySlot?.confirmedAt) {
        return NextResponse.json(
          {
            error: "Delivery slot is already confirmed",
          },
          { status: 409 },
        );
      }

      const proposedDate = new Date(dateTime);
      if (Number.isNaN(proposedDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      const updateResult = await db.collection<Order>("orders").updateOne(
        { _id: orderId, process_status: "ready" },
        {
          $set: {
            deliverySlot: {
              proposedBy: "provider",
              dateTime: proposedDate,
              proposedAt: new Date(),
            },
            updatedAt: new Date(),
          },
        }
      );
      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Order state changed while proposing delivery slot" },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: true, message: "Delivery proposed" });
    } else if (action === "confirm") {
      if (user.role !== Role.SEEKER) {
        return NextResponse.json(
          { error: "Only seekers can confirm delivery slots" },
          { status: 403 }
        );
      }
      if (order.seeker_id.toString() !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if ((order.process_status || "invoiced") !== "ready") {
        return NextResponse.json(
          {
            error:
              "Delivery slot can only be confirmed while order is ready for dispatch",
            currentStatus: order.process_status || "invoiced",
          },
          { status: 409 },
        );
      }

      if (!order.deliverySlot)
        return NextResponse.json(
          { error: "No slot proposed" },
          { status: 400 }
        );
      if (order.deliverySlot.proposedBy !== "provider") {
        return NextResponse.json(
          { error: "Invalid delivery slot proposal" },
          { status: 409 },
        );
      }
      if (order.deliverySlot.confirmedAt) {
        return NextResponse.json(
          { success: true, message: "Delivery slot already confirmed" },
          { status: 200 },
        );
      }

      const updateResult = await db.collection<Order>("orders").updateOne(
        {
          _id: orderId,
          process_status: "ready",
          "deliverySlot.proposedBy": "provider",
          "deliverySlot.confirmedAt": { $exists: false },
        },
        {
          $set: {
            "deliverySlot.confirmedAt": new Date(),
            updatedAt: new Date(),
          },
        }
      );
      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Order state changed while confirming delivery slot" },
          { status: 409 },
        );
      }
      return NextResponse.json({
        success: true,
        message:
          "Delivery slot confirmed. Provider can now move order to out_for_delivery.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ORDERS", "Scheduling error", error, { orderId: id, action });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
