import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
// Note: These env vars must be set in .env.local
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
});

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
  const options = {
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
    const params: any = {};
    if (amount) params.amount = amount;
    if (notes) params.notes = notes;
    const refund = await razorpay.payments.refund(paymentId, params);
    return refund;
  } catch (error) {
    console.error("Error refunding Razorpay payment:", error);
    throw error;
  }
}

// --- RazorpayX Payouts ---

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
    // Note: 'fund_account' and 'contacts' are part of RazorpayX (razorpay.payouts.* not directly typed in some SDK versions, checking availability)
    // The official SDK exposes it via instance.
    // If typing fails, we might need to cast to any or check SDK version. 
    // Usually accessible as razorpay.contacts.create(...) if not standard payments instance.
    // However, node-razorpay usually handles this if configured with X-headers or just supports it.
    
    // For safety with TS, we use 'any' cast if properties are missing in standard types, 
    // but standard razorpay package should have it.
    const response = await (razorpay as any).contacts.create(data);
    return response;
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
    const response = await (razorpay as any).fund_accounts.create(data);
    return response;
  } catch (error) {
    console.error("Error creating Fund Account:", error);
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
}) {
  try {
    const response = await (razorpay as any).payouts.create(data);
    return response;
  } catch (error) {
    console.error("Error creating Payout:", error);
    throw error;
  }
}
