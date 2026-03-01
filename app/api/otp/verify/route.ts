import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { NextRequest } from "next/server";
import { otpVerifySchema } from "@/lib/api/schemas";
import { verifyOtp } from "@/lib/otp";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:otp:verify",
      max: 25,
      windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
    });

    const json = await req.json();
    const parsed = otpVerifySchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid params", parsed));
    }

    const { target, type, code } = parsed.data;
    const res = await verifyOtp(target, type, code);
    if (!res.ok) return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, res.error || "Invalid OTP"));
    return successResponse({
      success: true
    }, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("OTP", "Error verifying OTP", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to verify OTP"));
  }
}
