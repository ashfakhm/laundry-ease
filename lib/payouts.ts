import { ObjectId } from "mongodb";
import type { Order } from "@/types/orders";
import { getDb } from "@/lib/mongodb";
import { releaseEscrowPayment } from "@/lib/db";
import { createRazorpayPayout } from "@/lib/razorpay";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const PAYOUT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const PAYOUT_ERROR_MAX_LENGTH = 500;

type PayoutResultStatus =
  | "payout_initiated"
  | "already_paid_out"
  | "already_processing"
  | "not_found"
  | "not_eligible"
  | "not_due"
  | "blocked_by_complaint"
  | "escrow_release_blocked"
  | "failed_no_fund_account"
  | "failed_account_not_configured"
  | "failed_invalid_amount"
  | "failed_razorpay_error";

export type PayoutResult = {
  orderId: string;
  status: PayoutResultStatus;
  payoutId?: string;
  message?: string;
};

export type PayoutBatchResult = {
  processed: number;
  results: PayoutResult[];
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function derivePayoutAmounts(order: Order): {
  providerPayoutAmount: number;
  platformCommission: number;
} {
  const total = Number(order.total_price || 0);
  const storedPayout =
    typeof order.provider_payout_amount === "number"
      ? Number(order.provider_payout_amount)
      : null;
  const storedCommission =
    typeof order.platform_commission === "number"
      ? Number(order.platform_commission)
      : null;

  if (storedPayout !== null && Number.isFinite(storedPayout)) {
    const normalizedPayout = round2(Math.max(0, storedPayout));
    const derivedCommission = round2(Math.max(0, total - normalizedPayout));
    return {
      providerPayoutAmount: normalizedPayout,
      platformCommission:
        storedCommission !== null && Number.isFinite(storedCommission)
          ? round2(Math.max(0, storedCommission))
          : derivedCommission,
    };
  }

  if (storedCommission !== null && Number.isFinite(storedCommission)) {
    const normalizedCommission = round2(Math.max(0, storedCommission));
    return {
      providerPayoutAmount: round2(Math.max(0, total - normalizedCommission)),
      platformCommission: normalizedCommission,
    };
  }

  const defaultCommission = round2(Math.max(0, total * 0.05));
  return {
    providerPayoutAmount: round2(Math.max(0, total - defaultCommission)),
    platformCommission: defaultCommission,
  };
}

function normalizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > PAYOUT_ERROR_MAX_LENGTH
    ? raw.slice(0, PAYOUT_ERROR_MAX_LENGTH)
    : raw;
}

async function hasBlockingComplaint(orderId: ObjectId): Promise<boolean> {
  const { db } = await getDb();
  const complaint = await db.collection("complaints").findOne({
    order_id: orderId,
    status: { $nin: ["resolved", "rejected"] },
  });
  return Boolean(complaint);
}

async function releasePayoutLock(orderId: ObjectId, set?: Record<string, unknown>) {
  const { db } = await getDb();
  await db.collection<Order>("orders").updateOne(
    { _id: orderId },
    {
      ...(set ? { $set: { ...set, payout_updated_at: new Date() } } : {}),
      $unset: { payout_lock_at: "" },
    },
  );
}

async function markPayoutFailed(orderId: ObjectId, error: unknown) {
  const { db } = await getDb();
  const message = normalizeErrorMessage(error);
  await db.collection<Order>("orders").updateOne(
    { _id: orderId },
    {
      $set: {
        payout_status: "failed",
        payout_failure_reason: message,
        payout_failure_at: new Date(),
        payout_updated_at: new Date(),
      },
      $unset: { payout_lock_at: "" },
    },
  );
}

export async function initiateOrderPayout(
  orderId: ObjectId,
  options?: {
    ignoreEscrowDate?: boolean;
    source?: string;
  },
): Promise<PayoutResult> {
  const now = new Date();
  const staleLockCutoff = new Date(Date.now() - PAYOUT_LOCK_TIMEOUT_MS);
  const source = options?.source || "payout_processor";
  const { db } = await getDb();

  const order = await db.collection<Order>("orders").findOne({ _id: orderId });
  if (!order) {
    return { orderId: orderId.toString(), status: "not_found" };
  }

  if (order.payout_id) {
    return {
      orderId: orderId.toString(),
      status: "already_paid_out",
      payoutId: order.payout_id,
    };
  }

  const lockResult = await db.collection<Order>("orders").updateOne(
    {
      _id: orderId,
      payout_id: { $exists: false },
      $or: [
        { payout_lock_at: { $exists: false } },
        { payout_lock_at: { $lt: staleLockCutoff } },
      ],
    },
    {
      $set: {
        payout_lock_at: now,
        payout_status: "processing",
        payout_updated_at: now,
      },
    },
  );

  if (lockResult.modifiedCount === 0) {
    return { orderId: orderId.toString(), status: "already_processing" };
  }

  try {
    const lockedOrder = await db.collection<Order>("orders").findOne({ _id: orderId });
    if (!lockedOrder) {
      await releasePayoutLock(orderId);
      return { orderId: orderId.toString(), status: "not_found" };
    }

    if (lockedOrder.payout_id) {
      await releasePayoutLock(orderId);
      return {
        orderId: orderId.toString(),
        status: "already_paid_out",
        payoutId: lockedOrder.payout_id,
      };
    }

    if (
      lockedOrder.payment_status !== "held" &&
      lockedOrder.payment_status !== "released"
    ) {
      await releasePayoutLock(orderId, { payout_status: "pending" });
      return { orderId: orderId.toString(), status: "not_eligible" };
    }

    if (await hasBlockingComplaint(orderId)) {
      await releasePayoutLock(orderId, { payout_status: "pending" });
      return { orderId: orderId.toString(), status: "blocked_by_complaint" };
    }

    if (lockedOrder.payment_status === "held" && !options?.ignoreEscrowDate) {
      const releaseAt = toDate(lockedOrder.escrow_release_at);
      if (!releaseAt || releaseAt > now) {
        await releasePayoutLock(orderId, { payout_status: "pending" });
        return { orderId: orderId.toString(), status: "not_due" };
      }
    }

    if (lockedOrder.payment_status === "held") {
      const released = await releaseEscrowPayment(orderId);
      if (!released) {
        await releasePayoutLock(orderId, { payout_status: "pending" });
        return { orderId: orderId.toString(), status: "escrow_release_blocked" };
      }
    }

    const currentOrder = await db.collection<Order>("orders").findOne({ _id: orderId });
    if (!currentOrder) {
      await releasePayoutLock(orderId);
      return { orderId: orderId.toString(), status: "not_found" };
    }

    if (currentOrder.payout_id) {
      await releasePayoutLock(orderId);
      return {
        orderId: orderId.toString(),
        status: "already_paid_out",
        payoutId: currentOrder.payout_id,
      };
    }

    const provider = await db
      .collection("providers")
      .findOne({ _id: currentOrder.provider_id });
    if (!provider?.razorpay_fund_account_id) {
      await releasePayoutLock(orderId, {
        payout_status: "failed",
        payout_failure_reason: "Provider payout account not configured",
        payout_failure_at: new Date(),
      });
      return { orderId: orderId.toString(), status: "failed_no_fund_account" };
    }

    if (!env.RAZORPAYX_ACCOUNT_NUMBER) {
      await releasePayoutLock(orderId, {
        payout_status: "failed",
        payout_failure_reason: "Platform payout account not configured",
        payout_failure_at: new Date(),
      });
      return {
        orderId: orderId.toString(),
        status: "failed_account_not_configured",
      };
    }

    const { providerPayoutAmount, platformCommission } =
      derivePayoutAmounts(currentOrder);
    const amountInPaise = Math.round(providerPayoutAmount * 100);
    if (amountInPaise <= 0) {
      await releasePayoutLock(orderId, {
        payout_status: "failed",
        payout_failure_reason: "Invalid payout amount",
        payout_failure_at: new Date(),
      });
      return { orderId: orderId.toString(), status: "failed_invalid_amount" };
    }

    const payout = await createRazorpayPayout({
      account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: provider.razorpay_fund_account_id,
      amount: amountInPaise,
      currency: "INR",
      mode: "NEFT",
      purpose: "payout",
      narration: `Payout for Order ${currentOrder._id.toString().slice(-6)}`,
      reference_id: currentOrder._id.toString(),
    });

    const payoutUpdate = await db.collection<Order>("orders").updateOne(
      { _id: orderId, payout_id: { $exists: false } },
      {
        $set: {
          payout_status: "processing",
          payout_id: payout.id,
          payout_initiated_at: new Date(),
          payout_updated_at: new Date(),
          platform_commission: platformCommission,
          provider_payout_amount: providerPayoutAmount,
        },
        $unset: {
          payout_lock_at: "",
          payout_failure_reason: "",
          payout_failure_at: "",
        },
      },
    );

    if (payoutUpdate.modifiedCount === 0) {
      await releasePayoutLock(orderId);
      return { orderId: orderId.toString(), status: "already_processing" };
    }

    logger.info("PAYOUTS", "Payout initiated", {
      orderId: orderId.toString(),
      payoutId: payout.id,
      source,
    });

    return {
      orderId: orderId.toString(),
      status: "payout_initiated",
      payoutId: payout.id,
    };
  } catch (error) {
    await markPayoutFailed(orderId, error);
    logger.error("PAYOUTS", "Payout processing failed", error, {
      orderId: orderId.toString(),
      source,
    });
    return {
      orderId: orderId.toString(),
      status: "failed_razorpay_error",
      message: normalizeErrorMessage(error),
    };
  }
}

export async function processEligibleEscrowPayouts(options?: {
  source?: string;
}): Promise<PayoutBatchResult> {
  const { db } = await getDb();
  const now = new Date();
  const source = options?.source || "payout_batch";

  const candidateOrders = await db
    .collection<Order>("orders")
    .find({
      payout_id: { $exists: false },
      $or: [
        { payment_status: "released" },
        {
          payment_status: "held",
          escrow_release_at: { $lte: now },
        },
      ],
    })
    .toArray();

  const results: PayoutResult[] = [];

  for (const order of candidateOrders) {
    const result = await initiateOrderPayout(order._id, {
      source,
    });
    results.push(result);
  }

  return {
    processed: results.length,
    results,
  };
}
