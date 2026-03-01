import { NextRequest } from "next/server";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Order } from "@/types/orders";
import { logger } from "@/lib/logger";
import { orderScheduleDeliverySchema } from "@/lib/api/schemas";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAuth } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";

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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"));
    }
    const orderId = new ObjectId(id);

    const body = await req.json();
    const parsed = orderScheduleDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid schedule data"));
    }

    const parsedData = parsed.data;
    action = parsedData.action;
    const { dateTime } = parsedData;

    const { db } = await getDb();
    const order = await db
      .collection<Order>("orders")
      .findOne({ _id: orderId });

    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
    }

    if (action === "propose") {
      if (user.role !== Role.PROVIDER) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Only providers can propose delivery"));
      }
      if (order.provider_id.toString() !== user.id) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
      }

      if (!dateTime)
        return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Date required"));
      if ((order.process_status || "invoiced") !== "ready") {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Delivery slots can only be proposed when order is ready for dispatch"));
      }
      if (order.deliverySlot?.confirmedAt) {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Delivery slot is already confirmed"));
      }

      const proposedDate = new Date(dateTime);
      if (Number.isNaN(proposedDate.getTime())) {
        return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid date"));
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
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Order state changed while proposing delivery slot"));
      }
      return successResponse({ message: "Delivery proposed" });
    } else if (action === "confirm") {
      if (user.role !== Role.SEEKER) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Only seekers can confirm delivery slots"));
      }
      if (order.seeker_id.toString() !== user.id) {
        return errorResponse(new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"));
      }
      if ((order.process_status || "invoiced") !== "ready") {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Delivery slot can only be confirmed while order is ready for dispatch"));
      }

      if (!order.deliverySlot)
        return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "No slot proposed"));
      if (order.deliverySlot.proposedBy !== "provider") {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Invalid delivery slot proposal"));
      }
      if (order.deliverySlot.confirmedAt) {
        return successResponse({ message: "Delivery slot already confirmed" });
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
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Order state changed while confirming delivery slot"));
      }
      return successResponse({ message: "Delivery slot confirmed. Provider can now move order to out_for_delivery." });
    }

    return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid action"));
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Scheduling error", error, { orderId: id, action });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Server Error"));
  }
}
