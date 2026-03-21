import {
  POST as createOrderPayment,
  PUT as verifyOrderPayment,
} from "../payment/route";

// Legacy alias for /api/orders/[id]/payment
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return createOrderPayment(req, { params: ctx.params });
}

// Legacy alias for /api/orders/[id]/payment verification
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return verifyOrderPayment(req, { params: ctx.params });
}
