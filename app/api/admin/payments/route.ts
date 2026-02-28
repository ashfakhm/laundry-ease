import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { initiateOrderPayout } from "@/lib/payouts";
import type { Order } from "@/types/orders";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/response";

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

export async function GET(req: Request) {
  try {
    await enforceRateLimit(req, {
      bucket: "admin:payments:get",
      max: 40,
      windowMs: 60 * 1000,
    });
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

    return NextResponse.json({
      success: true,
      data: enrichedOrders
    }, {
      status: 200
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("ADMIN_PAYMENTS", "Error fetching payments", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
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
      return NextResponse.json({
        success: false,
        error: "Validation error",
        details: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
    }

    const { orderId, action, amount, reason } = parsed.data;
    if (!ObjectId.isValid(orderId)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order ID"));
    }

    const { db } = await getDb();
    const orderObjectId = new ObjectId(orderId);
    const order = await db.collection<Order>("orders").findOne({
      _id: orderObjectId,
    });
    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"));
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
        return NextResponse.json({
          success: false,

          error: payoutResult.message ||
            `Unable to initiate payout (${payoutResult.status})`,

          result: payoutResult
        }, {
          status: 409
        });
      }

      await db.collection("admin_logs").insertOne({
        admin: session.user.email || null,
        orderId,
        action,
        amount: 0,
        reason: reason || "Manual payout release",
        at: new Date(),
      });

      return NextResponse.json({
        success: true,
        result: payoutResult
      }, {
        status: 200
      });
    }

    if (action === "refund") {
      if (order.payment_status === "refunded") {
        return NextResponse.json({
          success: true,
          result: "already_refunded",
          idempotent: true
        }, {
          status: 200
        });
      }

      if (!["paid", "held", "released"].includes(order.payment_status)) {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Order payment is not in a refundable state"));
      }

      if (order.payout_id && order.payout_status !== "failed") {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Cannot auto-refund after payout has been initiated. Resolve manually with provider recovery."));
      }

      if (!order.razorpay_payment_id) {
        return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Payment reference missing on order"));
      }

      const refundAmount =
        typeof amount === "number" ? amount : Number(order.total_price || 0);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid refund amount"));
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

      return NextResponse.json({
        success: true,
        result: refund
      }, {
        status: 200
      });
    }

    if (typeof amount !== "number" || !reason) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Penalty amount and reason are required"));
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

    return NextResponse.json({
      success: true,
      result: { status: "penalty_recorded", amount }
    }, {
      status: 200
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("ADMIN_PAYMENTS", "Error in admin payment action", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"));
  }
}
