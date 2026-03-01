import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { getOrderById } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ComplaintMessage } from "@/types/complaints";
import {
  refundRazorpayPayment,
  fetchRazorpayPaymentDetails,
} from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { adminComplaintResolveSchema } from "@/lib/api/schemas";
import { initiateOrderPayout } from "@/lib/payouts";
import { derivePayoutAmounts } from "@/lib/payouts/amounts";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { errorResponse, successResponse } from "@/lib/api/response";

const EPSILON = 0.01;
const PAISE_MULTIPLIER = 100;

type RequestOutcome =
  | "refund_full"
  | "refund_partial"
  | "release_payout"
  | "reject";

type ComplaintDbOutcome = "refund_full" | "refund_partial" | "release_payout";

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

  if (
    typeof seekerRefundAmountInput !== "number" ||
    !Number.isFinite(seekerRefundAmountInput)
  ) {
    throw new Error("seeker_refund_amount is required for partial settlement.");
  }

  const normalizedAmount = round2(seekerRefundAmountInput);
  if (
    normalizedAmount < 0 ||
    normalizedAmount - distributableAmount > EPSILON
  ) {
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
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const session = await requireAdminWithDbCheck();

    const body = await req.json();
    const parsed = adminComplaintResolveSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid resolution data", parsed));
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid complaint id"));
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
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Complaint has already been finalized"));
    }

    const orderId = complaint.order_id;
    const order = await getOrderById(orderId);
    if (!order) {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Order Not Found"));
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
      return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Order has no distributable amount remaining for complaint settlement."));
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
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, message));
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
    let payoutPendingManual = false;
    let refundApplied = false;
    let refundPendingManual = false;

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

        // When RazorpayX is not configured or provider has no fund account,
        // mark payout as pending manual transfer instead of failing entirely.
        const manualPayoutStatuses = new Set([
          "failed_no_fund_account",
          "failed_account_not_configured",
        ]);

        if (successStatuses.has(payoutResult.status)) {
          payoutApplied = true;
        } else if (manualPayoutStatuses.has(payoutResult.status)) {
          payoutPendingManual = true;
          await db.collection("orders").updateOne(
            { _id: orderId },
            {
              $set: {
                payout_status: "pending_manual",
                provider_payout_amount: providerPayoutAmount,
                platform_commission: round2(platformCommission),
                payout_updated_at: new Date(),
              },
              $unset: {
                payout_lock_at: "",
                payout_failure_reason: "",
                payout_failure_at: "",
              },
            },
          );
          logger.warn("ADMIN_COMPLAINTS", "Payout marked as pending_manual", {
            complaintId: id,
            reason: payoutResult.status,
            providerPayoutAmount,
          });
        } else {
          throw new Error(
            payoutResult.message ||
              `Unable to release payout (status: ${payoutResult.status})`,
          );
        }
      }

      if (seekerRefundAmount > EPSILON) {
        if (!order.razorpay_payment_id) {
          // No payment reference — mark as manual refund needed
          refundPendingManual = true;
          logger.warn(
            "ADMIN_COMPLAINTS",
            "Refund marked as pending_manual (no payment ID)",
            {
              complaintId: id,
              seekerRefundAmount,
            },
          );
        } else {
          try {
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
          } catch (refundError) {
            // Razorpay refund failed — mark as manual refund needed
            refundPendingManual = true;
            logger.warn(
              "ADMIN_COMPLAINTS",
              "Refund marked as pending_manual (Razorpay error)",
              {
                complaintId: id,
                seekerRefundAmount,
                error:
                  refundError instanceof Error
                    ? refundError.message
                    : String(refundError),
              },
            );
          }
        }
      }
    } catch (finError: unknown) {
      if (!payoutApplied && !refundApplied) {
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
        payoutApplied,
        refundApplied,
      });

      await db.collection("complaint_messages").insertOne({
        complaint_id: complaintId,
        sender_id: new ObjectId(session.user.id),
        sender_role: "system",
        message_type: "SYSTEM",
        content:
          !payoutApplied && !refundApplied
            ? `Failed to finalize complaint due to financial action error: ${details}`
            : `Complaint finalized but follow-up is needed. ${details}. payoutApplied=${payoutApplied}, refundApplied=${refundApplied}`,
        createdAt: new Date(),
      });

      return errorResponse(new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        !payoutApplied && !refundApplied
          ? "Financial Action Failed"
          : "Financial Action Partially Applied"
      ));
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

    await db.collection("complaint_messages").insertOne(systemMsg);

    // Fetch contact/bank details for manual transfers
    let manualTransferDetails: Record<string, unknown> | undefined;
    if (payoutPendingManual || refundPendingManual) {
      manualTransferDetails = {};

      if (payoutPendingManual && order.provider_id) {
        const provider = await db.collection("providers").findOne(
          { _id: order.provider_id },
          {
            projection: {
              name: 1,
              businessName: 1,
              email: 1,
              phone: 1,
              bankDetails: 1,
            },
          },
        );
        if (provider) {
          manualTransferDetails.provider = {
            name: provider.businessName || provider.name || "Provider",
            email: provider.email,
            phone: provider.phone,
            upiId: provider.bankDetails?.upiId || null,
            accountNumber: provider.bankDetails?.accountNumber || null,
            ifsc: provider.bankDetails?.ifsc || null,
            accountHolderName: provider.bankDetails?.accountHolderName || null,
          };
        }
      }

      if (refundPendingManual && order.seeker_id) {
        const seeker = await db
          .collection("seekers")
          .findOne(
            { _id: order.seeker_id },
            { projection: { name: 1, email: 1, phone: 1 } },
          );

        // Fetch payment method details from Razorpay to get seeker's UPI/bank info
        let paymentDetails = null;
        if (order.razorpay_payment_id) {
          paymentDetails = await fetchRazorpayPaymentDetails(
            order.razorpay_payment_id,
          );
        }

        if (seeker) {
          manualTransferDetails.seeker = {
            name: seeker.name || "Seeker",
            email: paymentDetails?.email || seeker.email,
            phone: paymentDetails?.contact || seeker.phone,
            paymentMethod: paymentDetails?.method || null,
            vpa: paymentDetails?.vpa || null,
            bank: paymentDetails?.bank || null,
            card: paymentDetails?.card || null,
            wallet: paymentDetails?.wallet || null,
          };
        }
      }
    }

    return successResponse({ outcome: resolved.dbOutcome,
      status: resolved.dbStatus,
      payoutPendingManual,
      refundPendingManual,
      manualTransferDetails,

      settlement: {
        seeker_refund_amount: seekerRefundAmount,
        provider_payout_amount: providerPayoutAmount,
        platform_commission: round2(platformCommission),
        distributable_amount: normalizedDistributableAmount,
      } });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("ADMIN_COMPLAINTS", "Error resolving dispute", error, {
      complaintId: id,
    });
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal Error"));
  }
}
