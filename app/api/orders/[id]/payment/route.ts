import { getDb } from "@/lib/mongodb";
import { RATE_LIMIT_DEFAULT_WINDOW_MS } from "@/lib/constants";
import { ObjectId } from "mongodb";
import { createRazorpayOrder, verifyRazorpaySignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { paymentVerifySchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// POST: Create Razorpay Order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:payment:init",
      max: 8,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id");
    }
    const orderId = new ObjectId(id);

    const { db } = await getDb();
    const order = await db.collection("orders").findOne({
      _id: orderId,
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Order not found");
    }

    if (
      order.payment_status === "paid" ||
      order.payment_status === "held" ||
      order.payment_status === "released" ||
      order.payment_status === "refunded"
    ) {
      throw new AppError(ErrorCode.CONFLICT, 400, "Order is already paid");
    }

    const amountInPaise = Math.round(order.total_price * 100);

    logger.info("PAYMENT", "Creating Razorpay order", {
      orderId: id,
      orderTotalPrice: order.total_price,
      amountInPaise,
    });

    if (amountInPaise <= 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid order amount",
      );
    }

    const razorpayOrder = await createRazorpayOrder(amountInPaise, id);

    logger.info("PAYMENT", "Razorpay order created", {
      razorpayOrderId: razorpayOrder.id,
      razorpayAmount: razorpayOrder.amount,
    });
    await db.collection("orders").updateOne(
      { _id: orderId },
      {
        $set: {
          razorpay_order_id: razorpayOrder.id,
          updatedAt: new Date(),
        },
      },
    );

    const response = {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: env.RAZORPAY_KEY_ID,
    };

    logger.info("PAYMENT", "Sending payment response", response);

    return successResponse(response);
  } catch (error) {
    logger.error("ORDERS", "Payment init error", error, { orderId: id });
    return errorResponse(error);
  }
}

// PUT: Verify Payment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:payment:verify",
      max: 10,
      windowMs: RATE_LIMIT_DEFAULT_WINDOW_MS,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id");
    }
    const orderId = new ObjectId(id);

    const body = await req.json();
    const parsed = paymentVerifySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid payment verification payload",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      parsed.data;
    const { db } = await getDb();

    const order = await db.collection("orders").findOne({
      _id: orderId,
      seeker_id: new ObjectId(user.id),
    });

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Order not found");
    }

    if (
      (order.payment_status === "paid" ||
        order.payment_status === "held" ||
        order.payment_status === "released") &&
      order.razorpay_payment_id === razorpay_payment_id
    ) {
      return successResponse({ idempotent: true });
    }

    if (
      order.payment_status === "paid" ||
      order.payment_status === "held" ||
      order.payment_status === "released"
    ) {
      throw new AppError(ErrorCode.CONFLICT, 409, "Order is already paid");
    }

    if (
      !order.razorpay_order_id ||
      order.razorpay_order_id !== razorpay_order_id
    ) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Razorpay order mismatch",
      );
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid signature");
    }

    const now = new Date();

    const result = await db.collection("orders").updateOne(
      { _id: orderId, payment_status: "unpaid" },
      {
        $set: {
          payment_status: "paid",
          payment_made_at: now,
          razorpay_payment_id,
          process_status: order.process_status ?? "invoiced",
          updatedAt: now,
        },
      },
    );

    if (result.modifiedCount === 0) {
      const latest = await db.collection("orders").findOne({ _id: orderId });
      if (
        latest?.payment_status &&
        ["paid", "held", "released"].includes(latest.payment_status) &&
        latest.razorpay_payment_id === razorpay_payment_id
      ) {
        return successResponse({ idempotent: true });
      }
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        "Order payment state changed. Please refresh and retry.",
      );
    }

    return successResponse({ updated: true });
  } catch (error) {
    logger.error("ORDERS", "Payment verification error", error, {
      orderId: id,
    });
    return errorResponse(error);
  }
}
