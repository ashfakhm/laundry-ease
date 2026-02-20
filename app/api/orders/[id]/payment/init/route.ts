import { NextRequest } from "next/server";
import { POST as createOrderPayment } from "../route";
import { successResponse } from "@/lib/api/response";
import { ApiSuccessResponse } from "@/lib/api/errors";

// Legacy alias for order payment init
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const res = await createOrderPayment(req, ctx);
  if (!res.ok) {
    return res;
  }

  const json = (await res.json()) as ApiSuccessResponse<{
    id: string;
    amount: number;
    currency: string;
    key: string;
  }>;
  const data = json.data;

  // Map to standardized response
  // We keep the legacy field mapping (orderId vs id) inside the data object for clarity
  return successResponse({
    orderId: data.id,
    amount: data.amount,
    currency: data.currency,
    keyId: data.key,
  });
}
