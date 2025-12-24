import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { Order } from "@/types/orders";
import { env } from "@/lib/env";
import twilio from "twilio";

// POST: Update Order Process Status
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== Role.PROVIDER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const order_id = new ObjectId(id);
    const order = await getOrderById(order_id);

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (order.provider_id.toString() !== session.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;

    const validStatuses = [
      "processing",
      "washing",
      "ironing",
      "ready",
      "out_for_delivery",
      "delivered",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const { db } = await getDb();

    // Logic for Penalty Calculation when marking 'delivered' (or 'ready' if that stops the clock)
    // PRD: "If delivery exceeds the deadline... penalty... applied"
    // Usually penalty is finalized at 'delivered' or 'out_for_delivery'?
    // Let's calculate it when status becomes "delivered".

    // OTP Logic
    const updateData: any = {
      // Using any to allow dynamic fields like delivery_otp
      process_status: status,
      updatedAt: new Date(),
    };

    if (status === "out_for_delivery") {
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      updateData.delivery_otp = otp;
      // Send real SMS to seeker
      const { db } = await getDb();
      const seeker = await db
        .collection("seekers")
        .findOne({ _id: order.seeker_id });
      if (seeker?.phone) {
        try {
          // Format phone number to E.164
          let phone = seeker.phone.trim().replace(/\s+/g, "");
          if (!phone.startsWith("+")) {
            // If 10 digits, assume India +91
            if (phone.length === 10) {
              phone = `+91${phone}`;
            } else if (phone.startsWith("0")) {
                phone = `+91${phone.substring(1)}`;
            }
          }

          const smsClient = twilio(
            env.TWILIO_ACCOUNT_SID,
            env.TWILIO_AUTH_TOKEN
          );
          await smsClient.messages.create({
            body: `Your LaundryEase delivery OTP is ${otp}. Please share this code with your provider only upon delivery.`,
            from: env.TWILIO_PHONE_NUMBER,
            to: phone,
          });
        } catch (err) {
          console.error("Failed to send delivery OTP SMS:", err);
        }
      } else {
        console.warn("Seeker phone number not found, cannot send OTP SMS.");
      }
    }

    if (status === "delivered") {
      const { otp } = body;

      // If order allows "Seeker Confirmation" via checking their own device, we might skip this.
      // But for "Provider enters OTP" flow:
      if (!otp) {
        return NextResponse.json(
          { message: "OTP required for delivery confirmation" },
          { status: 400 }
        );
      }

      if (otp !== order.delivery_otp) {
        return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
      }

      updateData.otp_confirmed_at = new Date();
    }

    if (status === "delivered" && order.deadline) {
      const now = new Date();
      if (now > order.deadline) {
        // Calculate Penalty
        // Rule: 5% discount per hour late (max 30%)
        const lateHours =
          (now.getTime() - new Date(order.deadline).getTime()) /
          (1000 * 60 * 60);
        const penaltyRate = Math.min(lateHours * 0.05, 0.3);
        const penaltyAmount = Math.round(order.total_price * penaltyRate);

        updateData.latePenalty = penaltyAmount;
      }
    }

    await db
      .collection("orders")
      .updateOne({ _id: order_id }, { $set: updateData });

    revalidatePath(`/seeker/orders/${id}`);

    return NextResponse.json({
      message: "Status updated",
      latePenalty: updateData.latePenalty,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
