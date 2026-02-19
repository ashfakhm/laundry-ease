import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { orderScheduleDeliverySchema } from "@/lib/api/schemas";
import { Role } from "@/types/enums";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";
import {
  appErrorLegacyResponse,
  legacyErrorResponse,
  legacyMessageResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";

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
      return legacyErrorResponse("Unauthorized", 401);
    }

    if (!ObjectId.isValid(id)) {
      return legacyErrorResponse("Invalid order id", 400);
    }
    const orderId = new ObjectId(id);

    const body = await req.json();
    const parsed = orderScheduleDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return legacyMessageResponse("Invalid schedule data", 400, {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const parsedData = parsed.data;
    action = parsedData.action;
    const { dateTime } = parsedData;

    const { db } = await getDb();
    const order = await db
      .collection<Order>("orders")
      .findOne({ _id: orderId });

    if (!order) {
      return legacyErrorResponse("Order not found", 404);
    }

    if (action === "propose") {
      if (user.role !== Role.PROVIDER) {
        return legacyErrorResponse("Only providers can propose delivery", 403);
      }
      if (order.provider_id.toString() !== user.id) {
        return legacyErrorResponse("Unauthorized", 403);
      }

      if (!dateTime)
        return legacyErrorResponse("Date required", 400);
      if ((order.process_status || "invoiced") !== "ready") {
        return legacyMessageResponse(
          "Delivery slots can only be proposed when order is ready for dispatch",
          409,
          { currentStatus: order.process_status || "invoiced" },
        );
      }
      if (order.deliverySlot?.confirmedAt) {
        return legacyErrorResponse("Delivery slot is already confirmed", 409);
      }

      const proposedDate = new Date(dateTime);
      if (Number.isNaN(proposedDate.getTime())) {
        return legacyErrorResponse("Invalid date", 400);
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
        return legacyErrorResponse(
          "Order state changed while proposing delivery slot",
          409,
        );
      }
      return legacySuccessResponse({ message: "Delivery proposed" });
    } else if (action === "confirm") {
      if (user.role !== Role.SEEKER) {
        return legacyErrorResponse("Only seekers can confirm delivery slots", 403);
      }
      if (order.seeker_id.toString() !== user.id) {
        return legacyErrorResponse("Unauthorized", 403);
      }
      if ((order.process_status || "invoiced") !== "ready") {
        return legacyMessageResponse(
          "Delivery slot can only be confirmed while order is ready for dispatch",
          409,
          { currentStatus: order.process_status || "invoiced" },
        );
      }

      if (!order.deliverySlot)
        return legacyErrorResponse("No slot proposed", 400);
      if (order.deliverySlot.proposedBy !== "provider") {
        return legacyErrorResponse("Invalid delivery slot proposal", 409);
      }
      if (order.deliverySlot.confirmedAt) {
        return legacySuccessResponse(
          { message: "Delivery slot already confirmed" },
          200,
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
        return legacyErrorResponse(
          "Order state changed while confirming delivery slot",
          409,
        );
      }
      return legacySuccessResponse({
        message:
          "Delivery slot confirmed. Provider can now move order to out_for_delivery.",
      });
    }

    return legacyErrorResponse("Invalid action", 400);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ORDERS", "Scheduling error", error, { orderId: id, action });
    return legacyErrorResponse("Internal Server Error", 500);
  }
}
