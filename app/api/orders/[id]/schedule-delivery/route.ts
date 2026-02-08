import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { orderScheduleDeliverySchema } from "@/lib/api/schemas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Role } from "@/types/enums";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

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

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let orderId: ObjectId;
    try {
      orderId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

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
      if (session.user.role !== Role.PROVIDER) {
        return NextResponse.json(
          { error: "Only providers can propose delivery" },
          { status: 403 }
        );
      }
      if (order.provider_id.toString() !== session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (!dateTime)
        return NextResponse.json({ error: "Date required" }, { status: 400 });

      await db.collection<Order>("orders").updateOne(
        { _id: orderId },
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
      if (session.user.role !== Role.SEEKER) {
        return NextResponse.json(
          { error: "Only seekers can confirm delivery slots" },
          { status: 403 }
        );
      }
      if (order.seeker_id.toString() !== session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (!order.deliverySlot)
        return NextResponse.json(
          { error: "No slot proposed" },
          { status: 400 }
        );

      await db.collection<Order>("orders").updateOne(
        { _id: orderId },
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

    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    logger.error("ORDERS", "Scheduling error", error, { orderId: id, action });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
