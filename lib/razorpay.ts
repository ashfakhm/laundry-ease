import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
// Note: These env vars must be set in .env.local
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
});

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

// Extend default Razorpay instance type if needed, or just cast usage
type RazorpayInstance = Razorpay & { payouts: RazorpayPayouts };

/**
 * Create a Razorpay Order
 * @param amount Amount in smallest currency unit (paise)
 * @param currency Currency code (default INR)
 * @param receipt Internal order ID
 */
export async function createRazorpayOrder(
  amount: number,
  receipt: string,
  currency: string = "INR"
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
    console.error("Error creating Razorpay order:", error);
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
  signature: string
): boolean {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dummy_secret")
    .update(orderId + "|" + paymentId)
    .digest("hex");

  return generatedSignature === signature;
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
  notes?: Record<string, string>
) {
  try {
    const params: { amount?: number; notes?: Record<string, string> } = {};
    if (amount) params.amount = amount;
    if (notes) params.notes = notes;
    const refund = await razorpay.payments.refund(paymentId, params);
    return refund;
  } catch (error) {
    console.error("Error refunding Razorpay payment:", error);
    throw error;
  }
}

// --- RazorpayX Payouts (Direct Fetch Implementation for Robustness) ---

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const AUTH = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

async function razorpayFetch(endpoint: string, method: string, body?: unknown) {
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
        "Razorpay API Error"
    );
  }
  return res.json();
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
    const result = await razorpayFetch("/contacts", "POST", data);
    return result as unknown as RazorpayContact;
  } catch (error) {
    console.error("Error creating Razorpay contact:", error);
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
    const result = await razorpayFetch("/fund_accounts", "POST", data);
    return result as unknown as RazorpayFundAccount;
  } catch (error) {
    console.error("Error creating Fund Account:", error);
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
    const result = await razorpayFetch("/fund_accounts", "POST", data);
    return result as unknown as RazorpayFundAccount;
  } catch (error) {
    console.error("Error creating VPA Fund Account:", error);
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
  try {
    // Cast strict typed razorpay to local type with payouts
    const response = await (
      razorpay as unknown as RazorpayInstance
    ).payouts.create(data);
    return response;
  } catch (error) {
    console.error("Error creating Payout:", error);
    throw error;
  }
}
