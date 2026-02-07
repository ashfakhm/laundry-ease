import { NextRequest, NextResponse } from "next/server";
import { POST as createOrderPayment } from "../route";

// Legacy alias for order payment init
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await createOrderPayment(req, ctx);
  if (!res.ok) {
    return res;
  }

  const data = await res.json();
  return NextResponse.json({
    success: true,
    orderId: data.id,
    amount: data.amount,
    currency: data.currency,
    keyId: data.key,
  });
}
