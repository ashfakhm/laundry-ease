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
