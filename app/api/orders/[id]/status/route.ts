import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById } from "@/lib/db";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { orderStatusUpdateSchema } from "@/lib/api/schemas";
import {
  getAllowedNextStates,
  type OrderProcessStatus,
} from "@/lib/orders/status-machine";
import { sendDeliveryOtpEmail } from "@/lib/delivery-otp-email";

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

    // Work progression is blocked until payment is completed.
    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "held" &&
      order.payment_status !== "released"
    ) {
      return NextResponse.json(
        { message: "Order must be paid before updating workflow status" },
        { status: 400 }
      );
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

    const currentStatus = (order.process_status ||
      "invoiced") as OrderProcessStatus;
    const allowedNextStates = getAllowedNextStates(currentStatus);

    if (!allowedNextStates.includes(status as OrderProcessStatus)) {
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
    const updateData: {
      process_status: OrderProcessStatus;
      updatedAt: Date;
      delivery_otp?: string;
    } = {
      process_status: status as OrderProcessStatus,
      updatedAt: new Date(),
    };

    if (status === "out_for_delivery") {
      // Generate OTP for delivery confirmation
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      updateData.delivery_otp = otp;
      // Send OTP to seeker via email (Gmail)
      const seeker = await db
        .collection("seekers")
        .findOne({ _id: order.seeker_id });
      if (seeker?.email) {
        try {
          await sendDeliveryOtpEmail({
            to: String(seeker.email),
            otp,
            orderId: id,
            ttlMinutes: 10,
          });
        } catch (err) {
          logger.error("ORDERS", "Failed to send delivery OTP email", err, {
            orderId: id,
          });
        }
      } else {
        logger.warn("ORDERS", "Seeker email not found, cannot send OTP email", {
          orderId: id,
        });
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
      currentStatus: status,
      allowedNextStates: getAllowedNextStates(status as OrderProcessStatus),
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
