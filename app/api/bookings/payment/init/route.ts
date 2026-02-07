import { NextRequest, NextResponse } from "next/server";
import { bookingPaymentInitSchema } from "@/lib/api/schemas";
import { POST as createBookingFeeOrder } from "../../[id]/pay/route";
import { env } from "@/lib/env";

// Legacy alias for booking fee payment init.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bookingPaymentInitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid booking ID",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const res = await createBookingFeeOrder(req, {
    params: Promise.resolve({ id: parsed.data.bookingId }),
  });

  if (!res.ok) {
    return res;
  }

  const data = await res.json();
  return NextResponse.json({
    success: true,
    orderId: data.id,
    amount: data.amount,
    currency: data.currency,
    keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
