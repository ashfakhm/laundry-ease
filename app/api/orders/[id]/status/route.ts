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
import { logger } from "@/lib/logger";
import { orderStatusUpdateSchema } from "@/lib/api/schemas";

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
    const parsed = orderStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid status data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    // STATE TRANSITION VALIDATION: Ensure valid transitions from current state
    // Orders start at "invoiced" and must progress: invoiced → processing → washing → ironing → ready → out_for_delivery → delivered
    const validTransitions: Record<string, string[]> = {
      invoiced: ["processing"],
      processing: ["washing", "ready"], // Can skip directly to ready if simple service
      washing: ["ironing", "ready"], // Can skip ironing if not needed
      ironing: ["ready"],
      ready: ["out_for_delivery"],
      out_for_delivery: ["delivered"],
      // delivered is terminal
    };

    const currentStatus = order.process_status || "invoiced";
    const allowedNextStates = validTransitions[currentStatus] || [];

    if (!allowedNextStates.includes(status)) {
      logger.warn("ORDERS", "Invalid state transition attempted", {
        orderId: id,
        currentStatus,
        attemptedStatus: status,
        allowedNextStates,
      });
      return NextResponse.json(
        {
          error: "Invalid state transition",
          message: `Cannot transition from "${currentStatus}" to "${status}". Allowed next states: ${allowedNextStates.join(
            ", "
          )}`,
          currentStatus,
          allowedNextStates,
        },
        { status: 422 }
      );
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
      // Generate OTP for delivery confirmation
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      updateData.delivery_otp = otp;
      // Send real SMS to seeker with OTP
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
          logger.info("ORDERS", "Delivery OTP SMS sent", {
            orderId: id,
            phone: phone.substring(0, 4) + "***",
          });
        } catch (err) {
          logger.error("ORDERS", "Failed to send delivery OTP SMS", err, {
            orderId: id,
          });
        }
      } else {
        logger.warn(
          "ORDERS",
          "Seeker phone number not found, cannot send OTP SMS",
          { orderId: id }
        );
      }
    }

    // CRITICAL: "delivered" status can ONLY be set through confirm-delivery endpoint
    // This endpoint handles workflow status (processing → washing → ironing → ready → out_for_delivery)
    // Delivery confirmation requires OTP and must go through /api/orders/[id]/confirm-delivery
    // Schema validation ensures "delivered" cannot be sent here

    // Late penalty calculation happens in confirm-delivery endpoint, not here
    // This endpoint only handles workflow status transitions (processing → washing → ironing → ready → out_for_delivery)

    await db
      .collection("orders")
      .updateOne({ _id: order_id }, { $set: updateData });

    revalidatePath(`/seeker/orders/${id}`);

    return NextResponse.json({
      message: "Status updated successfully",
    });
  } catch (error) {
    logger.error("ORDERS", "Error updating order status", error, {
      orderId: id,
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
