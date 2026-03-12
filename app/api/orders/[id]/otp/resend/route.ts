import { successResponse, errorResponse } from "@/lib/api/response";
import { getOrderById } from "@/lib/db/index";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireProvider } from "@/lib/api/auth";
import { DELIVERY_OTP_TTL_MS, RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid order id"),
      );
    }

    const { user } = await requireProvider();

    const order_id = new ObjectId(id);
    const order = (await getOrderById(
      order_id,
    )) as OrderWithDeliveryOtpMeta | null;

    if (!order) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Order not found"),
      );
    }

    if (order.provider_id.toString() !== user.id) {
      return errorResponse(
        new AppError(ErrorCode.FORBIDDEN, 403, "Unauthorized"),
      );
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "OTP can only be resent when order is out for delivery"));
    }

    const { db } = await getDb();
    const seeker = await db
      .collection("seekers")
      .findOne({ _id: order.seeker_id });

    if (!seeker?.email) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Seeker email not found"),
      );
    }

    const now = new Date();

    const resendCount = Number(order.delivery_otp_resend_count ?? 0);

    // Rate limit: ensure minimum interval between resends.
    // Skip time-based throttle on first resend (resend_count === 0) so the
    // auto-send triggered when the OTP modal opens isn't blocked by the
    // timestamp set during the out_for_delivery transition.
    if (order.delivery_otp_sent_at && resendCount > 0) {
      const last = new Date(order.delivery_otp_sent_at);
      if (now.getTime() - last.getTime() < MIN_RESEND_INTERVAL_MS) {
        return errorResponse(new AppError(ErrorCode.RATE_LIMITED, 429, "OTP resent too recently. Please wait before trying again."));
      }
    }

    if (resendCount >= MAX_RESENDS) {
      return errorResponse(
        new AppError(
          ErrorCode.RATE_LIMITED,
          429,
          "OTP resend limit reached. Please contact support.",
        ),
      );
    }

    // Generate a new OTP and send it.
    const crypto = await import("crypto");
    const otp = crypto.randomInt(100000, 1000000).toString();
    const bcrypt = await import("bcrypt");
    const { BCRYPT_SALT_ROUNDS } = await import("@/lib/constants");
    const hashedOtp = await bcrypt.hash(otp, BCRYPT_SALT_ROUNDS);

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
      return errorResponse(
        new AppError(ErrorCode.INTERNAL_ERROR, 502, "Failed to send OTP email"),
      );
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

    return successResponse({
      message: "OTP resent",
      otpExpiresAt: otpExpiresAt.toISOString(),
      resendCount: resendCount + 1,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ORDERS", "Error resending delivery OTP", error, {
      orderId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
