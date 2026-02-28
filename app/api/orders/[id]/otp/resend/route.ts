import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { DELIVERY_OTP_TTL_MS } from "@/lib/constants";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";

const MIN_RESEND_INTERVAL_MS = 60_000; // 1 minute
const MAX_RESENDS = 5;

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  if (!user) return `***@${domain}`;
  const prefix = user.slice(0, Math.min(2, user.length));
  return `${prefix}***@${domain}`;
}

// The DB layer returns extra fields that may not be present on the shared Order type.
type OrderWithDeliveryOtpMeta = Awaited<ReturnType<typeof getOrderById>> & {
  delivery_otp_sent_at?: Date | string;
  delivery_otp_resend_count?: number;
  process_status?: string;
  provider_id: ObjectId;
  seeker_id: ObjectId;
};

// POST: Resend delivery OTP without changing order status
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "orders:otp:resend",
      max: 25,
      windowMs: 5 * 60 * 1000,
    });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: "Invalid order id"
      }, {
        status: 400
      });
    }

    const { user } = await requireProvider();

    const order_id = new ObjectId(id);
    const order = (await getOrderById(
      order_id,
    )) as OrderWithDeliveryOtpMeta | null;

    if (!order) {
      return NextResponse.json({
        success: false,
        error: "Order not found"
      }, {
        status: 404
      });
    }

    if (order.provider_id.toString() !== user.id) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, {
        status: 403
      });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return NextResponse.json({
        success: true,
        message: "OTP can only be resent when order is out for delivery",
        currentStatus: order.process_status || "invoiced"
      }, {
        status: 409
      });
    }

    const { db } = await getDb();
    const seeker = await db
      .collection("seekers")
      .findOne({ _id: order.seeker_id });

    if (!seeker?.email) {
      return NextResponse.json({
        success: false,
        error: "Seeker email not found"
      }, {
        status: 400
      });
    }

    const now = new Date();

    // Rate limit: ensure minimum interval between resends.
    if (order.delivery_otp_sent_at) {
      const last = new Date(order.delivery_otp_sent_at);
      if (now.getTime() - last.getTime() < MIN_RESEND_INTERVAL_MS) {
        const retryAfterSeconds = Math.ceil(
          (MIN_RESEND_INTERVAL_MS - (now.getTime() - last.getTime())) / 1000,
        );
        return NextResponse.json({
          success: true,
          message: "OTP resent too recently. Please wait before trying again.",
          retryAfterSeconds
        }, {
          status: 429
        });
      }
    }

    const resendCount = Number(order.delivery_otp_resend_count ?? 0);
    if (resendCount >= MAX_RESENDS) {
      return NextResponse.json({
        success: false,
        error: "OTP resend limit reached. Please contact support."
      }, {
        status: 429
      });
    }

    // Generate a new OTP and send it.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const bcrypt = await import("bcrypt");
    const hashedOtp = await bcrypt.hash(otp, 10);

    try {
      await enqueueEmailOutboxJob({
        kind: "delivery_otp",
        payload: {
          to: String(seeker.email),
          otp,
          orderId: id,
          ttlMinutes: Math.floor(DELIVERY_OTP_TTL_MS / 60_000),
        },
      });
      logger.info("ORDERS", "Delivery OTP email queued for resend", {
        orderId: id,
        to: maskEmail(String(seeker.email)),
      });
    } catch (err) {
      logger.error("ORDERS", "Failed to resend delivery OTP email", err, {
        orderId: id,
        to: maskEmail(String(seeker.email)),
      });
      return NextResponse.json({
        success: false,
        error: "Failed to send OTP email"
      }, {
        status: 502
      });
    }

    const otpExpiresAt = new Date(now.getTime() + DELIVERY_OTP_TTL_MS);

    await db.collection("orders").updateOne(
      { _id: order_id },
      {
        $set: {
          delivery_otp: hashedOtp,
          delivery_otp_sent_at: now,
          delivery_otp_expires_at: otpExpiresAt,
          updatedAt: now,
        },
        $inc: {
          delivery_otp_resend_count: 1,
        },
      },
    );

    return NextResponse.json({
      success: true,
      message: "OTP resent",
      otpExpiresAt: otpExpiresAt.toISOString(),
      resendCount: resendCount + 1
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

    logger.error("ORDERS", "Error resending delivery OTP", error, {
      orderId: id,
    });
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
