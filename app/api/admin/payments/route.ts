import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { razorpay } from "@/lib/razorpay";
import { updateOrderPaymentStatus, getOrderById } from "@/lib/db";

interface Order extends Record<string, unknown> {
  _id: ObjectId;
  seeker_id: string;
  provider_id: string;
  total_price: number;
  delivery_charge: number;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();

    const orders = await db
      .collection("orders")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich with seeker and provider data
    const enrichedOrders = await Promise.all(
      (orders as Order[]).map(async (order: Order) => {
        const seeker = await db
          .collection("seekers")
          .findOne(
            { _id: new ObjectId(order.seeker_id) },
            { projection: { name: 1 } }
          );

        const provider = await db
          .collection("providers")
          .findOne(
            { _id: new ObjectId(order.provider_id) },
            { projection: { name: 1, businessName: 1 } }
          );

        return {
          ...order,
          seeker,
          provider,
        };
      })
    );

    return NextResponse.json(enrichedOrders);
  } catch (error) {
    logger.error("ADMIN_PAYMENTS", "Error fetching payments", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Zod schema for refund/penalty actions
const actionSchema = z.object({
  orderId: z.string().min(1, "Order ID required"),
  action: z.enum(["refund", "penalty"]),
  amount: z.number().positive("Amount must be positive"),
  reason: z.string().min(3, "Reason required"),
});

/**
 * POST /api/admin/payments
 * Body: { orderId, action: "refund"|"penalty", amount, reason }
 * Only admin can trigger. Updates order/payment status and integrates with Razorpay if needed.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { orderId, action, amount, reason } = parsed.data;

    const { db } = await getDb();
    const order = await db
      .collection("orders")
      .findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only allow refund/penalty if payment is held or released
    if (!["held", "released", "paid"].includes(order.payment_status)) {
      return NextResponse.json(
        { error: "Refund/Penalty not allowed for this payment status" },
        { status: 400 }
      );
    }

    // Integrate with Razorpay for refund if needed
    let razorpayResult = null;
    if (action === "refund") {
      // Find paymentId from order
      const paymentId = order.razorpay_payment_id;
      if (!paymentId) {
        return NextResponse.json(
          { error: "No Razorpay payment ID found for this order" },
          { status: 400 }
        );
      }
      try {
        // Refund amount in paise (Razorpay expects smallest currency unit)
        const refund = await razorpay.payments.refund(paymentId, {
          amount: Math.round(amount * 100),
        });
        razorpayResult = refund;
        await db.collection("orders").updateOne(
          { _id: new ObjectId(orderId) },
          {
            $set: {
              payment_status: "refunded",
              refund_reason: reason,
              refund_amount: amount,
              refund_at: new Date(),
              razorpay_refund_id: refund.id,
            },
          }
        );
      } catch (err: any) {
        return NextResponse.json(
          { error: "Razorpay refund failed", details: err?.message || String(err) },
          { status: 500 }
        );
      }
    } else if (action === "penalty") {
      // Apply penalty: update order with penalty, optionally deduct from provider payout
      await db.collection("orders").updateOne(
        { _id: new ObjectId(orderId) },
        {
          $set: {
            latePenalty: amount,
            penalty_reason: reason,
            penalty_at: new Date(),
          },
        }
      );
      razorpayResult = { status: "penalty_recorded", amount };
    }

    // Optionally, log admin action
    await db.collection("admin_logs").insertOne({
      admin: session.user.email,
      orderId,
      action,
      amount,
      reason,
      at: new Date(),
    });

    return NextResponse.json({ ok: true, result: razorpayResult });
  } catch (error) {
    logger.error("ADMIN_PAYMENTS", "Error in admin refund/penalty", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
