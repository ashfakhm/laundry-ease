import { NextResponse } from "next/server";
import {
  getOrderById,
  buildConfirmDeliveryUpdateFields,
} from "@/lib/db/orders";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { confirmDeliverySchema } from "@/lib/api/schemas";
import { revalidatePath } from "next/cache";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { getDb } from "@/lib/mongodb";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { evaluateDeadlineCompensation } from "@/lib/orders/deadline-compensation";
import { requireSeeker } from "@/lib/api/auth";
import { DELIVERY_OTP_TTL_MS } from "@/lib/constants";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:confirm-delivery",
      max: 15,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireSeeker();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: "Invalid order id"
      }, {
        status: 400
      });
    }

    const body = await req.json();
    const parsed = confirmDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Invalid OTP data",
        fields: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
    }

    const { otp } = parsed.data;

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({
        success: false,
        error: "Order not found"
      }, {
        status: 404
      });
    }

    if (order.seeker_id.toString() !== user.id) {
      return NextResponse.json({
        success: false,
        error: "You are not authorized to confirm delivery for this order"
      }, {
        status: 403
      });
    }

    if ((order.process_status || "invoiced") === "delivered") {
      return NextResponse.json({
        success: true,
        message: "Delivery already confirmed",
        idempotent: true,

        deadlineCompensationApplied:
          order.payment_status === "refunded" ||
          Boolean(order.deadline_compensated_at)
      }, {
        status: 200
      });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return NextResponse.json({
        success: true,
        message: "Delivery can only be confirmed when order is out for delivery",
        currentStatus: order.process_status || "invoiced"
      }, {
        status: 409
      });
    }

    // If escrow has already started, payment_status will be "held" (or later "released").
    // Confirming delivery should still be allowed in these post-payment states so the UI can reach "Delivered".
    if (
      !(["paid", "held", "released", "refunded"] as readonly string[]).includes(
        order.payment_status,
      )
    ) {
      return NextResponse.json({
        success: false,
        error: "Order must be paid before confirming delivery"
      }, {
        status: 400
      });
    }

    const nowMs = Date.now();
    const otpExpiresAt = order.delivery_otp_expires_at;
    const otpSentAt = order.delivery_otp_sent_at;

    if (otpExpiresAt) {
      const expiryDate = new Date(otpExpiresAt);
      if (
        !Number.isNaN(expiryDate.getTime()) &&
        expiryDate.getTime() <= nowMs
      ) {
        return NextResponse.json({
          success: false,
          error: "OTP expired. Please resend OTP."
        }, {
          status: 410
        });
      }
    } else if (otpSentAt) {
      const sentDate = new Date(otpSentAt);
      if (
        !Number.isNaN(sentDate.getTime()) &&
        sentDate.getTime() + DELIVERY_OTP_TTL_MS <= nowMs
      ) {
        return NextResponse.json({
          success: false,
          error: "OTP expired. Please resend OTP."
        }, {
          status: 410
        });
      }
    }

    // Verify OTP using bcrypt (timing-safe and secure)
    if (!order.delivery_otp) {
      return NextResponse.json({
        success: false,
        error: "Invalid OTP"
      }, {
        status: 400
      });
    }
    const bcrypt = await import("bcrypt");
    const isOtpValid = await bcrypt.compare(otp, order.delivery_otp);
    if (!isOtpValid) {
      return NextResponse.json({
        success: false,
        error: "Invalid OTP"
      }, {
        status: 400
      });
    }

    const now = new Date();
    const orderDeadline = order.deadline ? new Date(order.deadline) : null;

    const alreadyCompensated =
      order.payment_status === "refunded" ||
      Boolean(order.deadline_compensated_at) ||
      Boolean(order.razorpay_refund_id);

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
      return NextResponse.json({
        success: false,

        error: compensationDecision.blockedMessage ||
          "Deadline compensation cannot be applied automatically."
      }, {
        status: 409
      });
    }

    const { db, client } = await getDb();
    const session = client.startSession();

    try {
      return await session.withTransaction(async () => {
        if (shouldRefund) {
          if (!order.razorpay_payment_id) {
            return NextResponse.json({
              success: false,
              error: "Deadline missed, but payment reference is unavailable for automatic refund. Please contact support."
            }, {
              status: 409
            });
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
            return NextResponse.json({
              success: false,
              error: "Deadline was missed, but refund could not be processed right now. Please retry."
            }, {
              status: 502
            });
          }
        }

        // We shouldn't use `confirmDelivery` here directly since it opens its own transaction
        // However, nested transactions are not supported.
        // We will inline the `confirmDelivery` functionality here.
        const orderCheck = await db
          .collection("orders")
          .findOne({ _id: order_id }, { session });
        if (!orderCheck) {
          return NextResponse.json({
            success: false,
            error: "Failed to confirm delivery"
          }, {
            status: 500
          });
        }

        const setFields = buildConfirmDeliveryUpdateFields(orderCheck, now);

        if (deadlineBreached && !alreadyCompensated) {
          Object.assign(setFields, {
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
              ? { payment_status: "refunded", latePenalty: paidAmount }
              : {}),
            updatedAt: new Date(),
          });
        }

        const res = await db
          .collection("orders")
          .updateOne({ _id: order_id }, { $set: setFields }, { session });

        const success = res.modifiedCount > 0;

        if (success) {
          revalidatePath(`/seeker/orders/${id}`);
          if (deadlineBreached && !alreadyCompensated) {
            return NextResponse.json({
              success: true,

              message: shouldRefund
                ? "Delivery confirmed. Deadline was missed and a full refund has been issued."
                : "Delivery confirmed. Deadline was missed and marked for no-charge completion.",

              deadlineCompensationApplied: shouldRefund,
              deadlineBreached: true
            }, {
              status: 200
            });
          }

          return NextResponse.json({
            success: true,
            message: "Delivery confirmed, escrow started"
          }, {
            status: 200
          });
        } else {
          return NextResponse.json({
            success: false,
            error: "Failed to confirm delivery"
          }, {
            status: 500
          });
        }
      });
    } finally {
      await session.endSession();
    }
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

    logger.error("ORDERS", "Error confirming delivery", error, { orderId: id });
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
