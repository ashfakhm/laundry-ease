import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { otpRequestSchema } from "@/lib/api/schemas";
import { requestOtp } from "@/lib/otp";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { logger } from "@/lib/logger";

function fingerprintTarget(type: "email" | "phone", target: string) {
  const normalized =
    type === "email" ? target.trim().toLowerCase() : target.trim();
  const hash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 24);
  return `${type}:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:otp:request:ip",
      max: 20,
      windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
    });

    const json = await req.json();
    const parsed = otpRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid params", parsed));
    }

    const { target, type } = parsed.data;
    await enforceRateLimit(req, {
      bucket: "auth:otp:request:target",
      max: 6,
      windowMs: 60 * 60 * 1000,
      identifier: fingerprintTarget(type, target),
    });

    const result = await requestOtp(target, type);

    if (!result.ok) {
      const isRateLimit =
        result.error?.includes("Too many") || result.error?.includes("rate");
      return errorResponse(new AppError(
        isRateLimit ? ErrorCode.RATE_LIMITED : ErrorCode.INTERNAL_ERROR,
        isRateLimit ? 429 : 502,
        result.error || "Rate limit or processing error"
      ));
    }

    return successResponse({
      success: true
    }, 200);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("OTP", "Error requesting OTP", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to request OTP"));
  }
}
