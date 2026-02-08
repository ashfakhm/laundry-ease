import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, confirmDelivery } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { confirmDeliverySchema } from "@/lib/api/schemas";
import { revalidatePath } from "next/cache";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { evaluateDeadlineCompensation } from "@/lib/orders/deadline-compensation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:confirm-delivery",
      max: 15,
      windowMs: 5 * 60 * 1000,
    });

    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = confirmDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid OTP data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { otp } = parsed.data;

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.seeker_id.toString() !== session.user.id) {
      return NextResponse.json(
        {
          message: "You are not authorized to confirm delivery for this order",
        },
        { status: 403 }
      );
    }

    if ((order.process_status || "invoiced") === "delivered") {
      return NextResponse.json({
        message: "Delivery already confirmed",
        idempotent: true,
        deadlineCompensationApplied:
          order.payment_status === "refunded" ||
          Boolean(
            (order as unknown as { deadline_compensated_at?: Date })
              .deadline_compensated_at,
          ),
      });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return NextResponse.json(
        {
          message: "Delivery can only be confirmed when order is out for delivery",
          currentStatus: order.process_status || "invoiced",
        },
        { status: 409 },
      );
    }

    // If escrow has already started, payment_status will be "held" (or later "released").
    // Confirming delivery should still be allowed in these post-payment states so the UI can reach "Delivered".
    if (
      !(["paid", "held", "released", "refunded"] as readonly string[]).includes(
        order.payment_status
      )
    ) {
      return NextResponse.json(
        { message: "Order must be paid before confirming delivery" },
        { status: 400 }
      );
    }

    // Verify OTP
    if (!order.delivery_otp || order.delivery_otp !== otp) {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
    }

    const now = new Date();
    const orderDeadline = order.deadline ? new Date(order.deadline) : null;

    const alreadyCompensated =
      order.payment_status === "refunded" ||
      Boolean(
        (order as unknown as { deadline_compensated_at?: Date })
          .deadline_compensated_at,
      ) ||
      Boolean(
        (order as unknown as { razorpay_refund_id?: string }).razorpay_refund_id,
      );

    const paidAmount = Number(order.total_price || 0);
    let refundId: string | null = null;
    const compensationDecision = evaluateDeadlineCompensation({
      now,
      deadline: orderDeadline,
      paymentStatus: order.payment_status,
      alreadyCompensated,
      paidAmount,
    });
    const { deadlineBreached, shouldRefund } = compensationDecision;

    if (compensationDecision.blocked) {
      return NextResponse.json(
        {
          message:
            compensationDecision.blockedMessage ||
            "Deadline compensation cannot be applied automatically.",
        },
        { status: 409 },
      );
    }

    if (shouldRefund) {
      if (!order.razorpay_payment_id) {
        return NextResponse.json(
          {
            message:
              "Deadline missed, but payment reference is unavailable for automatic refund. Please contact support.",
          },
          { status: 409 },
        );
      }

      try {
        const refund = await refundRazorpayPayment(
          order.razorpay_payment_id,
          Math.round(paidAmount * 100),
          {
            reason: "deadline_breach_full_refund",
            order_id: id,
          },
        );
        refundId = refund.id || null;
      } catch (error) {
        logger.error(
          "ORDERS",
          "Failed to refund late-delivery order before confirmation",
          error,
          { orderId: id },
        );
        return NextResponse.json(
          {
            message:
              "Deadline was missed, but refund could not be processed right now. Please retry.",
          },
          { status: 502 },
        );
      }
    }

    const success = await confirmDelivery(order_id);

    if (success) {
      if (deadlineBreached && !alreadyCompensated) {
        const { db } = await getDb();
        await db.collection("orders").updateOne(
          { _id: order_id },
          {
            $set: {
              deadline_breached_at: now,
              deadline_compensated_at: new Date(),
              deadline_compensation_mode: shouldRefund
                ? "full_refund"
                : "no_charge",
              refund_amount: shouldRefund ? paidAmount : 0,
              refund_reason: shouldRefund
                ? "Delivery confirmed after seeker deadline"
                : "Delivery confirmed after seeker deadline (no captured amount)",
              ...(refundId ? { razorpay_refund_id: refundId } : {}),
              ...(shouldRefund
                ? {
                    payment_status: "refunded",
                    latePenalty: paidAmount,
                  }
                : {}),
              updatedAt: new Date(),
            },
          },
        );

        revalidatePath(`/seeker/orders/${id}`);
        return NextResponse.json({
          message: shouldRefund
            ? "Delivery confirmed. Deadline was missed and a full refund has been issued."
            : "Delivery confirmed. Deadline was missed and marked for no-charge completion.",
          deadlineCompensationApplied: shouldRefund,
          deadlineBreached: true,
        });
      }

      revalidatePath(`/seeker/orders/${id}`);
      return NextResponse.json({
        message: "Delivery confirmed, escrow started",
      });
    } else {
      return NextResponse.json(
        { message: "Failed to confirm delivery" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ORDERS", "Error confirming delivery", error, { orderId: id });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
