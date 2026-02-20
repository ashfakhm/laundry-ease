import {
  legacyErrorResponse,
  legacySuccessResponse,
  appErrorLegacyResponse,
} from "@/lib/api/legacy-response";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { initiateOrderPayout } from "@/lib/payouts";
import type { Order } from "@/types/orders";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

function toObjectId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

const actionSchema = z.object({
  orderId: z.string().min(1, "Order ID required"),
  action: z.enum(["refund", "penalty", "release_payout"]),
  amount: z.number().positive().optional(),
  reason: z.string().min(3).optional(),
});

export async function GET() {
  try {
    await requireAdminWithDbCheck();

    const { db } = await getDb();
    const orders = await db
      .collection<Order>("orders")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const seekerIds = Array.from(
      new Set(
        orders
          .map((order) => toObjectId(order.seeker_id))
          .filter((id): id is ObjectId => Boolean(id))
          .map((id) => id.toString()),
      ),
    ).map((id) => new ObjectId(id));

    const providerIds = Array.from(
      new Set(
        orders
          .map((order) => toObjectId(order.provider_id))
          .filter((id): id is ObjectId => Boolean(id))
          .map((id) => id.toString()),
      ),
    ).map((id) => new ObjectId(id));

    const [seekers, providers] = await Promise.all([
      seekerIds.length > 0
        ? db
            .collection("seekers")
            .find({ _id: { $in: seekerIds } }, { projection: { name: 1 } })
            .toArray()
        : Promise.resolve([]),
      providerIds.length > 0
        ? db
            .collection("providers")
            .find(
              { _id: { $in: providerIds } },
              { projection: { name: 1, businessName: 1, profilePicture: 1 } },
            )
            .toArray()
        : Promise.resolve([]),
    ]);

    const seekerMap = new Map(
      seekers.map((seeker) => [seeker._id.toString(), seeker]),
    );
    const providerMap = new Map(
      providers.map((provider) => [provider._id.toString(), provider]),
    );

    const enrichedOrders = orders.map((order) => {
      const seekerId = toObjectId(order.seeker_id);
      const providerId = toObjectId(order.provider_id);
      return {
        ...order,
        seeker: seekerId ? seekerMap.get(seekerId.toString()) : null,
        provider: providerId ? providerMap.get(providerId.toString()) : null,
      };
    });

    return legacySuccessResponse({ data: enrichedOrders });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ADMIN_PAYMENTS", "Error fetching payments", error);
    return legacyErrorResponse("Internal server error", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:payments:action",
      max: 40,
      windowMs: 5 * 60 * 1000,
    });

    const session = await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return legacyErrorResponse(
        "Validation error",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { orderId, action, amount, reason } = parsed.data;
    if (!ObjectId.isValid(orderId)) {
      return legacyErrorResponse("Invalid order ID", 400);
    }

    const { db } = await getDb();
    const orderObjectId = new ObjectId(orderId);
    const order = await db.collection<Order>("orders").findOne({
      _id: orderObjectId,
    });
    if (!order) {
      return legacyErrorResponse("Order not found", 404);
    }

    if (action === "release_payout") {
      const payoutResult = await initiateOrderPayout(orderObjectId, {
        ignoreEscrowDate: true,
        source: "admin_payments_manual_release",
      });

      const successStatuses = new Set([
        "payout_initiated",
        "already_paid_out",
        "already_processing",
      ]);

      if (!successStatuses.has(payoutResult.status)) {
        return legacyErrorResponse(
          payoutResult.message ||
            `Unable to initiate payout (${payoutResult.status})`,
          409,
          { result: payoutResult },
        );
      }

      await db.collection("admin_logs").insertOne({
        admin: session.user.email || null,
        orderId,
        action,
        amount: 0,
        reason: reason || "Manual payout release",
        at: new Date(),
      });

      return legacySuccessResponse({ result: payoutResult });
    }

    if (action === "refund") {
      if (order.payment_status === "refunded") {
        return legacySuccessResponse({
          result: "already_refunded",
          idempotent: true,
        });
      }

      if (!["paid", "held", "released"].includes(order.payment_status)) {
        return legacyErrorResponse(
          "Order payment is not in a refundable state",
          409,
        );
      }

      if (order.payout_id && order.payout_status !== "failed") {
        return legacyErrorResponse(
          "Cannot auto-refund after payout has been initiated. Resolve manually with provider recovery.",
          409,
        );
      }

      if (!order.razorpay_payment_id) {
        return legacyErrorResponse("Payment reference missing on order", 409);
      }

      const refundAmount =
        typeof amount === "number" ? amount : Number(order.total_price || 0);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        return legacyErrorResponse("Invalid refund amount", 400);
      }

      const refund = await refundRazorpayPayment(
        order.razorpay_payment_id,
        Math.round(refundAmount * 100),
        {
          reason: reason || "admin_refund",
          order_id: orderId,
        },
      );

      await db.collection<Order>("orders").updateOne(
        { _id: orderObjectId },
        {
          $set: {
            payment_status: "refunded",
            refund_reason: reason || "Admin refund",
            refund_amount: refundAmount,
            refund_at: new Date(),
            updatedAt: new Date(),
            ...(refund.id ? { razorpay_refund_id: refund.id } : {}),
          },
          $unset: {
            payout_lock_at: "",
          },
        },
      );

      await db.collection("admin_logs").insertOne({
        admin: session.user.email || null,
        orderId,
        action,
        amount: refundAmount,
        reason: reason || "Admin refund",
        at: new Date(),
      });

      return legacySuccessResponse({ result: refund });
    }

    if (typeof amount !== "number" || !reason) {
      return legacyErrorResponse("Penalty amount and reason are required", 400);
    }

    await db.collection<Order>("orders").updateOne(
      { _id: orderObjectId },
      {
        $set: {
          latePenalty: amount,
          penalty_reason: reason,
          penalty_at: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    await db.collection("admin_logs").insertOne({
      admin: session.user.email || null,
      orderId,
      action,
      amount,
      reason,
      at: new Date(),
    });

    return legacySuccessResponse({
      result: { status: "penalty_recorded", amount },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("ADMIN_PAYMENTS", "Error in admin payment action", error);
    return legacyErrorResponse("Internal server error", 500);
  }
}
