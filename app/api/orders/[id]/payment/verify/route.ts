import { NextRequest } from "next/server";
import { PUT as verifyOrderPayment } from "../route";
import { successResponse } from "@/lib/api/response";
import { ApiSuccessResponse } from "@/lib/api/errors";

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

  const json = (await res.json()) as ApiSuccessResponse<
    { updated: boolean } | { idempotent: boolean }
  >;
  const data = json.data || json; // Fallback for safety

  return successResponse({
    message: "Payment verified",
    idempotent:
      "idempotent" in data
        ? (data as Record<string, unknown>).idempotent
        : false,
    ...data,
  });
}
