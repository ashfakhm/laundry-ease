import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getOrderById, getUserByEmail } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";
import { adminComplaintResolveSchema } from "@/lib/api/schemas";
import { initiateOrderPayout } from "@/lib/payouts";
import { derivePayoutAmounts } from "@/lib/payouts/amounts";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

const EPSILON = 0.01;
const PAISE_MULTIPLIER = 100;

type RequestOutcome = "refund_full" | "refund_partial" | "release_payout" | "reject";

type ComplaintDbOutcome =
  | "refund_full"
  | "refund_partial"
  | "release_payout";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatInr(amount: number): string {
  return `INR ${round2(amount).toFixed(2)}`;
}

function toPaise(amountInRupees: number): number {
  return Math.round(round2(amountInRupees) * PAISE_MULTIPLIER);
}

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

  if (complaint.resolution_breakdown) {
    setFields.resolution_breakdown = complaint.resolution_breakdown;
  } else {
    unsetFields.resolution_breakdown = "";
  }

  return {
    $set: setFields,
    ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
  };
}

function normalizeRefundAmount(
  outcome: RequestOutcome,
  seekerRefundAmountInput: number | undefined,
  distributableAmount: number,
): { seekerRefundAmount: number; normalizedOutcome: RequestOutcome } {
  if (outcome === "release_payout" || outcome === "reject") {
    return { seekerRefundAmount: 0, normalizedOutcome: outcome };
  }

  if (outcome === "refund_full") {
    return {
      seekerRefundAmount: round2(distributableAmount),
      normalizedOutcome: "refund_full",
    };
  }

  if (typeof seekerRefundAmountInput !== "number" || !Number.isFinite(seekerRefundAmountInput)) {
    throw new Error("seeker_refund_amount is required for partial settlement.");
  }

  const normalizedAmount = round2(seekerRefundAmountInput);
  if (normalizedAmount < 0 || normalizedAmount - distributableAmount > EPSILON) {
    throw new Error(
      `seeker_refund_amount must be within 0 and ${distributableAmount.toFixed(2)}.`,
    );
  }

  if (normalizedAmount <= EPSILON) {
    return { seekerRefundAmount: 0, normalizedOutcome: "release_payout" };
  }

  if (Math.abs(normalizedAmount - distributableAmount) <= EPSILON) {
    return {
      seekerRefundAmount: round2(distributableAmount),
      normalizedOutcome: "refund_full",
    };
  }

  return {
    seekerRefundAmount: normalizedAmount,
    normalizedOutcome: "refund_partial",
  };
}

function resolveDbOutcome(
  requestedOutcome: RequestOutcome,
  seekerRefundAmount: number,
  providerPayoutAmount: number,
): {
  dbStatus: "resolved" | "rejected";
  dbOutcome: ComplaintDbOutcome;
  statusMessage: string;
} {
  if (requestedOutcome === "reject") {
    return {
      dbStatus: "rejected",
      dbOutcome: "release_payout",
      statusMessage: "Complaint rejected in provider favor",
    };
  }

  if (providerPayoutAmount <= EPSILON) {
    return {
      dbStatus: "resolved",
      dbOutcome: "refund_full",
      statusMessage: "Complaint resolved in seeker favor",
    };
  }

  if (seekerRefundAmount <= EPSILON) {
    return {
      dbStatus: "resolved",
      dbOutcome: "release_payout",
      statusMessage: "Complaint resolved in provider favor",
    };
  }

  return {
    dbStatus: "resolved",
    dbOutcome: "refund_partial",
    statusMessage: "Complaint resolved with split settlement",
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

    const { outcome, seeker_refund_amount } = parsed.data;
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

    const { providerPayoutAmount: distributableAmount, platformCommission } =
      derivePayoutAmounts(order);

    const normalizedDistributableAmount = round2(distributableAmount);
    if (
      normalizedDistributableAmount <= EPSILON &&
      outcome !== "release_payout" &&
      outcome !== "reject"
    ) {
      return NextResponse.json(
        {
          error:
            "Order has no distributable amount remaining for complaint settlement.",
        },
        { status: 409 },
      );
    }

    let settlement;
    try {
      settlement = normalizeRefundAmount(
        outcome,
        seeker_refund_amount,
        normalizedDistributableAmount,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid settlement amount";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const seekerRefundAmount = settlement.seekerRefundAmount;
    const providerPayoutAmount = round2(
      Math.max(0, normalizedDistributableAmount - seekerRefundAmount),
    );

    const resolved = resolveDbOutcome(
      settlement.normalizedOutcome,
      seekerRefundAmount,
      providerPayoutAmount,
    );

    const complaintSetFields: Record<string, unknown> = {
      status: resolved.dbStatus,
      resolution_outcome: resolved.dbOutcome,
      resolvedAt: new Date(),
      resolution_breakdown: {
        seeker_refund_amount: seekerRefundAmount,
        provider_payout_amount: providerPayoutAmount,
        platform_commission: round2(platformCommission),
        distributable_amount: normalizedDistributableAmount,
      },
    };

    // Close participant access once complaint is finalized.
    if (resolved.dbStatus === "resolved" || resolved.dbStatus === "rejected") {
      complaintSetFields.provider_access_granted = false;
    }

    await db.collection("complaints").updateOne(
      { _id: complaintId },
      {
        $set: complaintSetFields,
      },
    );

    let refund: { id?: string } | null = null;
    let payoutApplied = false;
    let refundApplied = false;

    try {
      if (providerPayoutAmount > EPSILON) {
        const payoutResult = await initiateOrderPayout(orderId, {
          ignoreEscrowDate: true,
          source: `complaint_${settlement.normalizedOutcome}`,
          overrideProviderPayoutAmount: providerPayoutAmount,
          overridePlatformCommission: round2(platformCommission),
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

        payoutApplied = true;
      }

      if (seekerRefundAmount > EPSILON) {
        if (!order.razorpay_payment_id) {
          throw new Error(
            "Cannot process refund: payment reference missing on order.",
          );
        }

        refund = await refundRazorpayPayment(
          order.razorpay_payment_id,
          toPaise(seekerRefundAmount),
          {
            source: "complaint_resolution",
            complaint_id: complaintId.toString(),
            outcome: resolved.dbOutcome,
          },
        );
        refundApplied = true;
      }
    } catch (finError: unknown) {
      if (!payoutApplied && !refundApplied) {
        await db
          .collection("complaints")
          .updateOne({ _id: complaintId }, buildComplaintRevertUpdate(complaint));
      }

      const details =
        finError instanceof Error ? finError.message : "Unknown financial error";
      const safeDetails = !payoutApplied && !refundApplied
        ? "Financial action failed during complaint resolution"
        : "Partial financial action completed; manual follow-up required";

      logger.error("ADMIN_COMPLAINTS", "Financial action failed", finError, {
        complaintId: id,
        requestedOutcome: outcome,
        normalizedOutcome: settlement.normalizedOutcome,
        payoutApplied,
        refundApplied,
      });

      await db.collection("complaint_messages").insertOne({
        complaint_id: complaintId,
        sender_id: dbUser._id as ObjectId,
        sender_role: "system",
        message_type: "SYSTEM",
        content: !payoutApplied && !refundApplied
          ? `Failed to finalize complaint due to financial action error: ${details}`
          : `Complaint finalized but follow-up is needed. ${details}. payoutApplied=${payoutApplied}, refundApplied=${refundApplied}`,
        createdAt: new Date(),
      });

      return NextResponse.json(
        {
          error:
            !payoutApplied && !refundApplied
              ? "Financial Action Failed"
              : "Financial Action Partially Applied",
          details: safeDetails,
          payoutApplied,
          refundApplied,
        },
        { status: 500 },
      );
    }

    const orderSetFields: Record<string, unknown> = {
      platform_commission: round2(platformCommission),
      provider_payout_amount: providerPayoutAmount,
      updatedAt: new Date(),
    };

    if (seekerRefundAmount > EPSILON) {
      orderSetFields.refund_reason =
        resolved.dbOutcome === "refund_full"
          ? "Admin complaint resolution: seeker awarded full distributable amount"
          : "Admin complaint resolution: partial refund to seeker";
      orderSetFields.refund_amount = seekerRefundAmount;
      orderSetFields.refund_at = new Date();
      if (refund?.id) {
        orderSetFields.razorpay_refund_id = refund.id;
      }
    }

    if (providerPayoutAmount <= EPSILON) {
      orderSetFields.payment_status = "refunded";
    }

    const orderUnsetFields: Record<string, string> = {};
    if (providerPayoutAmount <= EPSILON) {
      orderUnsetFields.payout_lock_at = "";
    } else {
      orderUnsetFields.payout_failure_reason = "";
      orderUnsetFields.payout_failure_at = "";
    }

    await db.collection("orders").updateOne(
      { _id: orderId },
      {
        $set: orderSetFields,
        ...(Object.keys(orderUnsetFields).length > 0
          ? { $unset: orderUnsetFields }
          : {}),
      },
    );

    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: dbUser._id as ObjectId,
      sender_role: "system",
      message_type: "SYSTEM",
      content: `${resolved.statusMessage}. Seeker: ${formatInr(seekerRefundAmount)}, Provider: ${formatInr(providerPayoutAmount)}, Platform: ${formatInr(platformCommission)}.`,
      createdAt: new Date(),
    };

    await db.collection("complaint_messages").insertOne(systemMsg);

    return NextResponse.json({
      success: true,
      outcome: resolved.dbOutcome,
      status: resolved.dbStatus,
      settlement: {
        seeker_refund_amount: seekerRefundAmount,
        provider_payout_amount: providerPayoutAmount,
        platform_commission: round2(platformCommission),
        distributable_amount: normalizedDistributableAmount,
      },
    });
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
