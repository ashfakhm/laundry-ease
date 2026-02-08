import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, getUserByEmail } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { adminComplaintResolveSchema } from "@/lib/api/schemas";
import { initiateOrderPayout } from "@/lib/payouts";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

function buildComplaintRevertUpdate(complaint: Record<string, unknown>) {
  const setFields: Record<string, unknown> = {
    status: complaint.status,
  };
  const unsetFields: Record<string, string> = {};

  if (complaint.resolution_outcome) {
    setFields.resolution_outcome = complaint.resolution_outcome;
  } else {
    unsetFields.resolution_outcome = "";
  }

  if (complaint.resolvedAt) {
    setFields.resolvedAt = complaint.resolvedAt;
  } else {
    unsetFields.resolvedAt = "";
  }

  return {
    $set: setFields,
    ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:complaints:resolve",
      max: 40,
      windowMs: 5 * 60 * 1000,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        { status: 400 },
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid complaint id" }, { status: 400 });
    }

    const { outcome } = parsed.data;
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db.collection("complaints").findOne({ _id: complaintId });
    if (!complaint) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return NextResponse.json(
        { error: "Complaint has already been finalized" },
        { status: 409 },
      );
    }

    const orderId = complaint.order_id;
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order Not Found" }, { status: 404 });
    }

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
      },
    );

    try {
      if (outcome === "refund_full") {
        if (order.payment_status !== "refunded") {
          if (!order.razorpay_payment_id) {
            throw new Error(
              "Cannot process refund: payment reference missing on order.",
            );
          }

          const refund = await refundRazorpayPayment(order.razorpay_payment_id);

          await db.collection("orders").updateOne(
            { _id: orderId },
            {
              $set: {
                payment_status: "refunded",
                refund_reason: "Admin complaint resolution: full refund",
                refund_amount: Number(order.total_price || 0),
                ...(refund.id ? { razorpay_refund_id: refund.id } : {}),
                updatedAt: new Date(),
              },
              $unset: {
                payout_lock_at: "",
              },
            },
          );
        }
      } else if (outcome === "release_payout" || outcome === "reject") {
        const payoutResult = await initiateOrderPayout(orderId, {
          ignoreEscrowDate: true,
          source: `complaint_${outcome}`,
        });

        const successStatuses = new Set([
          "payout_initiated",
          "already_paid_out",
          "already_processing",
        ]);

        if (!successStatuses.has(payoutResult.status)) {
          throw new Error(
            payoutResult.message ||
              `Unable to release payout (status: ${payoutResult.status})`,
          );
        }
      }
    } catch (finError: unknown) {
      await db
        .collection("complaints")
        .updateOne({ _id: complaintId }, buildComplaintRevertUpdate(complaint));

      const details =
        finError instanceof Error ? finError.message : "Unknown financial error";

      logger.error("ADMIN_COMPLAINTS", "Financial action failed", finError, {
        complaintId: id,
        outcome,
      });

      await db.collection("complaint_messages").insertOne({
        complaint_id: complaintId,
        sender_id: dbUser._id as ObjectId,
        sender_role: "system",
        message_type: "SYSTEM",
        content: `Failed to finalize complaint due to financial action error: ${details}`,
        createdAt: new Date(),
      });

      return NextResponse.json(
        { error: "Financial Action Failed", details },
        { status: 500 },
      );
    }

    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: dbUser._id as ObjectId,
      sender_role: "system",
      message_type: "SYSTEM",
      content: `Complaint ${dbStatus}. Outcome: ${outcome}.`,
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ADMIN_COMPLAINTS", "Error resolving dispute", error, {
      complaintId: id,
    });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
