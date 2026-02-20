import { NextRequest } from "next/server";
import {
  legacyErrorResponse,
  legacySuccessResponse,
  appErrorLegacyResponse,
} from "@/lib/api/legacy-response";
import { otpVerifySchema } from "@/lib/api/schemas";
import { verifyOtp } from "@/lib/otp";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:otp:verify",
      max: 25,
      windowMs: 15 * 60 * 1000,
    });

    const json = await req.json();
    const parsed = otpVerifySchema.safeParse(json);
    if (!parsed.success) {
      return legacyErrorResponse(
        "Invalid params",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { target, type, code } = parsed.data;
    const res = await verifyOtp(target, type, code);
    if (!res.ok) return legacyErrorResponse(res.error || "Invalid OTP", 400);
    return legacySuccessResponse();
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("OTP", "Error verifying OTP", error);
    return legacyErrorResponse("Failed to verify OTP", 500);
  }
}
