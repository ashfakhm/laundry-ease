import Razorpay from "razorpay";
import crypto from "crypto";
import { logger } from "./logger";

// Note: env validation happens via env.ts schema
// This check is for runtime safety

// Initialize Razorpay
// Note: These env vars must be set in .env.local
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

function isE2EFakePaymentsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.E2E_FAKE_PAYMENTS === "1";
}

function createE2EId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

interface RazorpayOrderOptions {
  amount: string | number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

interface RazorpayContact {
  id: string;
  entity: string;
  name?: string;
  email?: string;
  contact?: string;
  reference_id?: string;
  batch_id?: string;
  active?: boolean;
  notes?: Record<string, string>;
  created_at?: number;
}

interface RazorpayFundAccount {
  id: string;
  entity: string;
  contact_id: string;
  account_type: "bank_account" | "vpa";
  bank_account?: {
    name: string;
    account_number: string;
    ifsc: string;
    bank_name: string;
  };
  vpa?: {
    address: string;
  };
  active?: boolean;
  created_at?: number;
}

interface RazorpayPayout {
  id: string;
  entity: string;
  fund_account_id: string;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
  fees?: number;
  tax?: number;
  status: string;
  utr?: string;
  mode: string;
  reference_id?: string;
  created_at?: number;
}

interface RazorpayPayouts {
  create: (data: Record<string, unknown>) => Promise<RazorpayPayout>;
}

/**
 * Create a Razorpay Order
 * @param amount Amount in smallest currency unit (paise)
 * @param currency Currency code (default INR)
 * @param receipt Internal order ID
 */
export async function createRazorpayOrder(
  amount: number,
  receipt: string,
  currency: string = "INR",
) {
  const options: RazorpayOrderOptions = {
    amount: amount.toString(),
    currency,
    receipt,
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    logger.error("RAZORPAY", "Error creating Razorpay order", error, {
      receipt,
    });
    throw error;
  }
}

/**
 * Verify Razorpay Payment Signature
 * @param orderId Razorpay Order ID
 * @param paymentId Razorpay Payment ID
 * @param signature Razorpay Signature
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedSignature),
      Buffer.from(signature),
    );
  } catch {
    // timingSafeEqual throws if lengths do not match
    return false;
  }
}

/**
 * Refund a payment
 * @param paymentId Razorpay Payment ID
 * @param amount Amount in paise (optional, refund full if not provided)
 * @param notes Optional notes for refund
 */
export async function refundRazorpayPayment(
  paymentId: string,
  amount?: number,
  notes?: Record<string, string>,
) {
  if (isE2EFakePaymentsEnabled()) {
    return {
      id: createE2EId("rfnd_e2e"),
      entity: "refund",
      payment_id: paymentId,
      amount: amount ?? 0,
      currency: "INR",
      status: "processed",
      notes: notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  try {
    const params: { amount?: number; notes?: Record<string, string> } = {};
    if (amount) params.amount = amount;
    if (notes) params.notes = notes;
    const refund = await razorpay.payments.refund(paymentId, params);
    return refund;
  } catch (error) {
    logger.error("RAZORPAY", "Error refunding Razorpay payment", error, {
      paymentId,
      amount,
    });
    throw error;
  }
}

/**
 * Fetch payment details (method, VPA, bank, card info) for a given payment ID
 * Useful for extracting seeker's payment details for manual refund
 */
export async function fetchRazorpayPaymentDetails(paymentId: string) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      method: payment.method || null, // upi, card, netbanking, wallet
      vpa: payment.vpa || null, // UPI VPA (e.g. user@upi)
      bank: payment.bank || null, // Bank code for netbanking
      wallet: payment.wallet || null,
      email: payment.email || null,
      contact: payment.contact || null,
      card: payment.card
        ? {
            last4: payment.card.last4 || null,
            network: payment.card.network || null,
            issuer: payment.card.issuer || null,
          }
        : null,
    };
  } catch (error) {
    logger.error("RAZORPAY", "Error fetching payment details", error, {
      paymentId,
    });
    return null;
  }
}

// --- RazorpayX Payouts (Direct Fetch Implementation for Robustness) ---

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const AUTH = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

async function razorpayFetch<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): Promise<T> {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error("Razorpay API Keys are missing in environment variables.");
  }

  const res = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${AUTH}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: { description: res.statusText } }));
    throw new Error(
      (err as { error?: { description?: string } }).error?.description ||
        "Razorpay API Error",
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Create a Contact (for Payouts)
 */
export async function createRazorpayContact(data: {
  name: string;
  email: string;
  contact: string; // phone number
  type: "vendor";
  reference_id?: string; // e.g., provider ID
}) {
  try {
    return await razorpayFetch<RazorpayContact>("/contacts", "POST", data);
  } catch (error) {
    logger.error("RAZORPAY", "Error creating Razorpay contact", error, {
      name: data.name,
    });
    throw error;
  }
}

/**
 * Create a Fund Account (Bank Details)
 */
export async function createRazorpayFundAccount(data: {
  contact_id: string;
  account_type: "bank_account";
  bank_account: {
    name: string;
    ifsc: string;
    account_number: string;
  };
}) {
  try {
    return await razorpayFetch<RazorpayFundAccount>(
      "/fund_accounts",
      "POST",
      data,
    );
  } catch (error) {
    logger.error("RAZORPAY", "Error creating Fund Account", error, {
      contactId: data.contact_id,
    });
    throw error;
  }
}

/**
 * Create a Fund Account (VPA/UPI)
 */
export async function createRazorpayFundAccountVpa(data: {
  contact_id: string;
  account_type: "vpa";
  vpa: {
    address: string;
  };
}) {
  try {
    return await razorpayFetch<RazorpayFundAccount>(
      "/fund_accounts",
      "POST",
      data,
    );
  } catch (error) {
    logger.error("RAZORPAY", "Error creating VPA Fund Account", error, {
      contactId: data.contact_id,
    });
    throw error;
  }
}

/**
 * Create a Payout
 */
export async function createRazorpayPayout(data: {
  account_number: string; // The specific RazorpayX account number from which money is sent (optional if default)
  fund_account_id: string;
  amount: number; // in paise
  currency: string;
  mode: "IMPS" | "NEFT" | "RTGS" | "UPI";
  purpose: "payout";
  queue_if_low_balance?: boolean;
  reference_id?: string;
  narration?: string;
}): Promise<RazorpayPayout> {
  if (isE2EFakePaymentsEnabled()) {
    return {
      id: createE2EId("pout_e2e"),
      entity: "payout",
      fund_account_id: data.fund_account_id,
      amount: data.amount,
      currency: data.currency,
      status: "processing",
      mode: data.mode,
      reference_id: data.reference_id,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  try {
    const payoutsApi = (razorpay as { payouts?: RazorpayPayouts }).payouts;
    if (!payoutsApi || typeof payoutsApi.create !== "function") {
      throw new Error("Razorpay payouts API is unavailable");
    }
    return await payoutsApi.create(data);
  } catch (error) {
    logger.error("RAZORPAY", "Error creating Payout", error, {
      fundAccountId: data.fund_account_id,
      amount: data.amount,
    });
    throw error;
  }
}
