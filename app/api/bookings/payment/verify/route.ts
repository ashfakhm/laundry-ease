import { NextRequest, NextResponse } from "next/server";
import { PUT as verifyBookingFeePayment } from "../../[id]/pay/route";

// Legacy alias for booking fee payment verification.
// Accepts legacy body shape and forwards canonical payload.
export async function POST(req: NextRequest) {
  const body = await req.json();

  const bookingId = body.bookingId;
  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

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

  const res = await verifyBookingFeePayment(forwardedReq, {
    params: Promise.resolve({ id: bookingId }),
  });

  if (!res.ok) {
    return res;
  }

  const json = await res.json();
  const data = json.data || json; // Fallback for safety

  return NextResponse.json({
    success: true,
    message: data?.message || "Payment verified",
    idempotent: Boolean(data?.idempotent ?? false),
  });
}
