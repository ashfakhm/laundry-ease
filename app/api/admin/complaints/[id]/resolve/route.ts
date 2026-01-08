import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, releaseEscrowPayment, getUserByEmail } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { adminComplaintResolveSchema } from "@/lib/api/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify Admin
    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser || dbUser.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = adminComplaintResolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid resolution data",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { outcome } = parsed.data; // refund_full, release_payout, reject
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint)
      return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const orderId = complaint.order_id;
    const order = await getOrderById(orderId);
    if (!order)
      return NextResponse.json({ error: "Order Not Found" }, { status: 404 });

    // 1. Update Complaint Status FIRST (to unblock payout check)
    const newStatus = outcome === "reject" ? "rejected" : "resolved";

    let dbOutcome: "refund_full" | "release_payout" | "reject" | "no_action" =
      outcome;
    let dbStatus = "resolved";

    if (outcome === "reject") {
      dbStatus = "rejected";
      dbOutcome = "no_action";
    }

    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: {
          status: dbStatus,
          resolution_outcome: dbOutcome,
          resolvedAt: new Date(),
        },
      }
    );

    // 2. Execute Financial Action
    try {
      if (outcome === "refund_full") {
        // Refund via Razorpay
        if (order.razorpay_payment_id) {
          await refundRazorpayPayment(order.razorpay_payment_id); // Full refund
          // Update Order status
          await db
            .collection("orders")
            .updateOne(
              { _id: orderId },
              { $set: { status: "cancelled", payment_status: "refunded" } }
            );
        }
      } else if (outcome === "release_payout" || outcome === "reject") {
        // Release Escrow
        // This calls helper which checks for complaints.
        // We just set status to resolved/rejected, so check will pass.
        await releaseEscrowPayment(orderId);
      }
    } catch (finError: any) {
      logger.error("ADMIN_COMPLAINTS", "Financial action failed", finError, {
        complaintId: id,
        outcome,
      });
      // Manual Intervention Needed
      await db.collection("complaint_messages").insertOne({
        complaint_id: complaintId,
        sender_id: dbUser!._id as ObjectId, // Assert
        sender_role: "system",
        message_type: "SYSTEM",
        content: `Error executing financial action: ${finError.message}. Please check Dashboard.`,
        createdAt: new Date(),
      });
      return NextResponse.json(
        { error: "Financial Action Failed", details: finError.message },
        { status: 500 }
      );
    }

    // 3. System Message (Success)
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: dbUser!._id as ObjectId, // Assert
      sender_role: "system",
      message_type: "SYSTEM",
      content: `Dispute ${dbStatus}. Outcome: ${outcome}.`,
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("ADMIN_COMPLAINTS", "Error resolving dispute", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
