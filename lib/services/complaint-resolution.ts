/**
 * Complaint resolution settlement logic.
 *
 * Extracted from the admin complaint resolve route to keep the handler thin.
 * Contains: settlement normalization, DB outcome resolution, financial
 * action execution (payout + refund), complaint revert, and manual
 * transfer detail fetching.
 */

import { Db, ObjectId } from "mongodb";
import {
  refundRazorpayPayment,
  fetchRazorpayPaymentDetails,
} from "@/lib/razorpay";
import { initiateOrderPayout } from "@/lib/payouts";
import { logger } from "@/lib/logger";
import { MONEY_EPSILON as EPSILON, round2, toPaise } from "@/lib/utils/monetary";

// ─── Types ───────────────────────────────────────────────────────────

export type RequestOutcome =
  | "refund_full"
  | "refund_partial"
  | "release_payout"
  | "reject";

export type ComplaintDbOutcome =
  | "refund_full"
  | "refund_partial"
  | "release_payout";

export type SettlementBreakdown = {
  seekerRefundAmount: number;
  providerPayoutAmount: number;
  platformCommission: number;
  distributableAmount: number;
};

export type FinancialActionResult = {
  refund: { id?: string } | null;
  payoutApplied: boolean;
  payoutPendingManual: boolean;
  refundApplied: boolean;
  refundPendingManual: boolean;
};

// ─── Settlement helpers ──────────────────────────────────────────────

export function normalizeRefundAmount(
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

export function resolveDbOutcome(
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

// ─── Complaint revert on failure ─────────────────────────────────────

export function buildComplaintRevertUpdate(
  complaint: Record<string, unknown>,
) {
  const setFields: Record<string, unknown> = {
    status: complaint.status,
  };
  const unsetFields: Record<string, string> = {};

  for (const key of [
    "resolution_outcome",
    "resolvedAt",
    "resolution_breakdown",
  ] as const) {
    if (complaint[key]) {
      setFields[key] = complaint[key];
    } else {
      unsetFields[key] = "";
    }
  }

  return {
    $set: setFields,
    ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
  };
}

// ─── Financial action execution ──────────────────────────────────────

export async function executeSettlementActions(
  db: Db,
  opts: {
    complaintId: string;
    orderId: ObjectId;
    order: { razorpay_payment_id?: string };
    seekerRefundAmount: number;
    providerPayoutAmount: number;
    platformCommission: number;
    normalizedOutcome: RequestOutcome;
    dbOutcome: ComplaintDbOutcome;
  },
): Promise<FinancialActionResult> {
  const {
    complaintId,
    orderId,
    order,
    seekerRefundAmount,
    providerPayoutAmount,
    platformCommission,
    normalizedOutcome,
    dbOutcome,
  } = opts;

  let refund: { id?: string } | null = null;
  let payoutApplied = false;
  let payoutPendingManual = false;
  let refundApplied = false;
  let refundPendingManual = false;

  if (providerPayoutAmount > EPSILON) {
    const payoutResult = await initiateOrderPayout(orderId, {
      ignoreEscrowDate: true,
      source: `complaint_${normalizedOutcome}`,
      overrideProviderPayoutAmount: providerPayoutAmount,
      overridePlatformCommission: round2(platformCommission),
    });

    const successStatuses = new Set([
      "payout_initiated",
      "already_paid_out",
      "already_processing",
    ]);

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
        complaintId,
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
      refundPendingManual = true;
      logger.warn(
        "ADMIN_COMPLAINTS",
        "Refund marked as pending_manual (no payment ID)",
        { complaintId, seekerRefundAmount },
      );
    } else {
      try {
        refund = await refundRazorpayPayment(
          order.razorpay_payment_id,
          toPaise(seekerRefundAmount),
          {
            source: "complaint_resolution",
            complaint_id: complaintId,
            outcome: dbOutcome,
          },
        );
        refundApplied = true;
      } catch (refundError) {
        refundPendingManual = true;
        logger.warn(
          "ADMIN_COMPLAINTS",
          "Refund marked as pending_manual (Razorpay error)",
          {
            complaintId,
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

  return {
    refund,
    payoutApplied,
    payoutPendingManual,
    refundApplied,
    refundPendingManual,
  };
}

// ─── Manual transfer detail fetching ─────────────────────────────────

export async function fetchManualTransferDetails(
  db: Db,
  order: { provider_id?: ObjectId; seeker_id?: ObjectId; razorpay_payment_id?: string },
  flags: { payoutPendingManual: boolean; refundPendingManual: boolean },
): Promise<Record<string, unknown> | undefined> {
  if (!flags.payoutPendingManual && !flags.refundPendingManual) return undefined;

  const details: Record<string, unknown> = {};

  if (flags.payoutPendingManual && order.provider_id) {
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
      details.provider = {
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

  if (flags.refundPendingManual && order.seeker_id) {
    const seeker = await db
      .collection("seekers")
      .findOne(
        { _id: order.seeker_id },
        { projection: { name: 1, email: 1, phone: 1 } },
      );

    let paymentDetails = null;
    if (order.razorpay_payment_id) {
      paymentDetails = await fetchRazorpayPaymentDetails(
        order.razorpay_payment_id,
      );
    }

    if (seeker) {
      details.seeker = {
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

  return Object.keys(details).length > 0 ? details : undefined;
}
