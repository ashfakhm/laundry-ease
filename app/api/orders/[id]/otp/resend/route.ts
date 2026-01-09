import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { sendDeliveryOtpEmail } from "@/lib/delivery-otp-email";

const MIN_RESEND_INTERVAL_MS = 60_000; // 1 minute
const MAX_RESENDS = 5;
const OTP_TTL_MS = 10 * 60_000; // 10 minutes

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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const order_id = new ObjectId(id);
    const order = (await getOrderById(
      order_id
    )) as OrderWithDeliveryOtpMeta | null;

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.provider_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    if ((order.process_status || "invoiced") !== "out_for_delivery") {
      return NextResponse.json(
        {
          message: "OTP can only be resent when order is out for delivery",
          currentStatus: order.process_status || "invoiced",
        },
        { status: 409 }
      );
    }

    const { db } = await getDb();
    const seeker = await db
      .collection("seekers")
      .findOne({ _id: order.seeker_id });

    if (!seeker?.email) {
      return NextResponse.json(
        { message: "Seeker email not found" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Rate limit: ensure minimum interval between resends.
    if (order.delivery_otp_sent_at) {
      const last = new Date(order.delivery_otp_sent_at);
      if (now.getTime() - last.getTime() < MIN_RESEND_INTERVAL_MS) {
        const retryAfterSeconds = Math.ceil(
          (MIN_RESEND_INTERVAL_MS - (now.getTime() - last.getTime())) / 1000
        );
        return NextResponse.json(
          {
            message:
              "OTP resent too recently. Please wait before trying again.",
            retryAfterSeconds,
          },
          { status: 429 }
        );
      }
    }

    const resendCount = Number(order.delivery_otp_resend_count ?? 0);
    if (resendCount >= MAX_RESENDS) {
      return NextResponse.json(
        {
          message: "OTP resend limit reached. Please contact support.",
        },
        { status: 429 }
      );
    }

    // Generate a new OTP and send it.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await sendDeliveryOtpEmail({
        to: String(seeker.email),
        otp,
        orderId: id,
        ttlMinutes: 10,
      });
      logger.info("ORDERS", "Delivery OTP email resent", {
        orderId: id,
        to: maskEmail(String(seeker.email)),
      });
    } catch (err) {
      logger.error("ORDERS", "Failed to resend delivery OTP email", err, {
        orderId: id,
        to: maskEmail(String(seeker.email)),
      });
      return NextResponse.json(
        {
          message: "Failed to send OTP email",
        },
        { status: 502 }
      );
    }

    const otpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);

    await db.collection("orders").updateOne(
      { _id: order_id },
      {
        $set: {
          delivery_otp: otp,
          delivery_otp_sent_at: now,
          delivery_otp_expires_at: otpExpiresAt,
          updatedAt: now,
        },
        $inc: {
          delivery_otp_resend_count: 1,
        },
      }
    );

    return NextResponse.json({
      message: "OTP resent",
      otpExpiresAt: otpExpiresAt.toISOString(),
      resendCount: resendCount + 1,
    });
  } catch (error) {
    logger.error("ORDERS", "Error resending delivery OTP", error, {
      orderId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
