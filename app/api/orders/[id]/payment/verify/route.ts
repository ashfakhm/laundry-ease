import { NextRequest, NextResponse } from "next/server";
import { PUT as verifyOrderPayment } from "../route";

// Legacy alias for order payment verification.
// Accepts legacy camelCase payload and forwards canonical snake_case body.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const body = await req.json();
  const normalizedPayload = {
    razorpay_order_id: body.razorpay_order_id || body.razorpayOrderId,
    razorpay_payment_id: body.razorpay_payment_id || body.razorpayPaymentId,
    razorpay_signature: body.razorpay_signature || body.razorpaySignature,
  };

  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");

  const forwardedReq = new Request(req.url, {
    method: "PUT",
    headers,
    body: JSON.stringify(normalizedPayload),
  });

  const res = await verifyOrderPayment(forwardedReq, ctx);
  if (!res.ok) {
    return res;
  }

  const data = await res.json();
  return NextResponse.json({
    success: Boolean(data?.success ?? true),
    message: data?.message || "Payment verified",
    idempotent: Boolean(data?.idempotent ?? false),
  });
}
