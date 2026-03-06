import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getOrderById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import { logger } from "@/lib/logger";
import { adminComplaintResolveSchema } from "@/lib/api/schemas";
import { derivePayoutAmounts } from "@/lib/payouts/amounts";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  MONEY_EPSILON as EPSILON,
  round2,
  formatInr,
} from "@/lib/utils/monetary";
import {
  normalizeRefundAmount,
  resolveDbOutcome,
  buildComplaintRevertUpdate,
  executeSettlementActions,
  fetchManualTransferDetails,
  fetchSettlementPartyDetails,
} from "@/lib/services/complaint-resolution";
import {
  emitComplaintMessageCreated,
  emitComplaintStateUpdated,
} from "@/lib/realtime/emitter";

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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const session = await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminComplaintResolveSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid resolution data",
          parsed,
        ),
      );
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid complaint id"),
      );
    }

    const { outcome, seeker_refund_amount } = parsed.data;
    const { db } = await getDb();
    const complaintId = new ObjectId(id);

    const complaint = await db
      .collection("complaints")
      .findOne({ _id: complaintId });
    if (!complaint) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Not Found"));
    }

    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          "Complaint has already been finalized",
        ),
      );
    }

    const orderId = complaint.order_id;
    const order = await getOrderById(orderId);
    if (!order) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Order Not Found"),
      );
    }

    const { providerPayoutAmountPaise, platformCommissionPaise } =
      derivePayoutAmounts(order);

    const distributableAmount = providerPayoutAmountPaise / 100;
    const platformCommission = platformCommissionPaise / 100;

    const normalizedDistributableAmount = round2(distributableAmount);
    if (
      normalizedDistributableAmount <= EPSILON &&
      outcome !== "release_payout" &&
      outcome !== "reject"
    ) {
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          "Order has no distributable amount remaining for complaint settlement.",
        ),
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
      const message =
        error instanceof Error ? error.message : "Invalid settlement amount";
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, message),
      );
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

    let financialResult;
    try {
      financialResult = await executeSettlementActions(db, {
        complaintId: id,
        orderId,
        order: { razorpay_payment_id: order.razorpay_payment_id },
        seekerRefundAmount,
        providerPayoutAmount,
        platformCommission: round2(platformCommission),
        normalizedOutcome: settlement.normalizedOutcome,
        dbOutcome: resolved.dbOutcome,
      });
    } catch (finError: unknown) {
      if (!financialResult?.payoutApplied && !financialResult?.refundApplied) {
        await db
          .collection("complaints")
          .updateOne(
            { _id: complaintId },
            buildComplaintRevertUpdate(complaint),
          );
      }

      const details =
        finError instanceof Error
          ? finError.message
          : "Unknown financial error";

      logger.error("ADMIN_COMPLAINTS", "Financial action failed", finError, {
        complaintId: id,
        requestedOutcome: outcome,
        normalizedOutcome: settlement.normalizedOutcome,
        payoutApplied: financialResult?.payoutApplied,
        refundApplied: financialResult?.refundApplied,
      });

      const insertResult = await db.collection("complaint_messages").insertOne({
        complaint_id: complaintId,
        sender_id: new ObjectId(session.user.id),
        sender_role: "system",
        message_type: "SYSTEM",
        content:
          !financialResult?.payoutApplied && !financialResult?.refundApplied
            ? `Failed to finalize complaint due to financial action error: ${details}`
            : `Complaint finalized but follow-up is needed. ${details}. payoutApplied=${financialResult?.payoutApplied}, refundApplied=${financialResult?.refundApplied}`,
        createdAt: new Date(),
      });
      emitComplaintMessageCreated({
        _id: insertResult.insertedId,
        complaint_id: complaintId,
        sender_id: new ObjectId(session.user.id),
        sender_role: "system",
        message_type: "SYSTEM",
        content:
          !financialResult?.payoutApplied && !financialResult?.refundApplied
            ? `Failed to finalize complaint due to financial action error: ${details}`
            : `Complaint finalized but follow-up is needed. ${details}. payoutApplied=${financialResult?.payoutApplied}, refundApplied=${financialResult?.refundApplied}`,
        createdAt: new Date(),
      });

      return errorResponse(
        new AppError(
          ErrorCode.INTERNAL_ERROR,
          500,
          !financialResult?.payoutApplied && !financialResult?.refundApplied
            ? "Financial Action Failed"
            : "Financial Action Partially Applied",
        ),
      );
    }

    const { refund, payoutPendingManual, refundPendingManual } =
      financialResult;

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

    const manualNotes: string[] = [];
    if (payoutPendingManual)
      manualNotes.push("Provider payout requires manual transfer.");
    if (refundPendingManual)
      manualNotes.push("Seeker refund requires manual transfer.");
    const manualNote =
      manualNotes.length > 0 ? " " + manualNotes.join(" ") : "";
    const systemMsg: Omit<ComplaintMessage, "_id"> = {
      complaint_id: complaintId,
      sender_id: new ObjectId(session.user.id),
      sender_role: "system",
      message_type: "SYSTEM",
      content: `${resolved.statusMessage}. Seeker: ${formatInr(seekerRefundAmount)}, Provider: ${formatInr(providerPayoutAmount)}, Platform: ${formatInr(platformCommission)}.${manualNote}`,
      createdAt: new Date(),
    };

    const insertResult = await db.collection("complaint_messages").insertOne(systemMsg);
    emitComplaintMessageCreated({
      _id: insertResult.insertedId,
      ...systemMsg,
    });
    emitComplaintStateUpdated({
      complaintId: id,
      status: resolved.dbStatus,
      providerAccessGranted: false,
    });

    const manualTransferDetails = await fetchManualTransferDetails(db, order, {
      payoutPendingManual,
      refundPendingManual,
    });

    const settlementPartyDetails = await fetchSettlementPartyDetails(
      db,
      order,
      { seekerRefundAmount, providerPayoutAmount },
      { payoutPendingManual, refundPendingManual },
    );

    return successResponse({
      outcome: resolved.dbOutcome,
      status: resolved.dbStatus,
      payoutPendingManual,
      refundPendingManual,
      manualTransferDetails,
      settlementPartyDetails,

      settlement: {
        seeker_refund_amount: seekerRefundAmount,
        provider_payout_amount: providerPayoutAmount,
        platform_commission: round2(platformCommission),
        distributable_amount: normalizedDistributableAmount,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ADMIN_COMPLAINTS", "Error resolving dispute", error, {
      complaintId: id,
    });
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Error"),
    );
  }
}
