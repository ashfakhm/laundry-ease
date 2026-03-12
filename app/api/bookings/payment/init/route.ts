import { NextRequest } from "next/server";
import { bookingPaymentInitSchema } from "@/lib/api/schemas";
import { POST as createBookingFeeOrder } from "../../[id]/pay/route";
import { env } from "@/lib/env";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode, ApiSuccessResponse } from "@/lib/api/errors";

// Legacy alias for booking fee payment init.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bookingPaymentInitSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid booking ID",
        parsed.error.flatten().fieldErrors,
      );
    }

    const res = await createBookingFeeOrder(req, {
      params: Promise.resolve({ id: parsed.data.bookingId }),
    });

    if (!res.ok) {
      return res;
    }

    const json = (await res.json()) as ApiSuccessResponse<{
      id: string;
      amount: number;
      currency: string;
    }>;
    // The inner handler returns data: { id, amount, currency }
    const { id, amount, currency } = json.data;

    return successResponse({
      orderId: id,
      amount: amount,
      currency: currency,
      keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
