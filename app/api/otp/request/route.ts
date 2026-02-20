import { createHash } from "crypto";
import { NextRequest } from "next/server";
import {
  legacyErrorResponse,
  legacySuccessResponse,
  appErrorLegacyResponse,
} from "@/lib/api/legacy-response";
import { otpRequestSchema } from "@/lib/api/schemas";
import { requestOtp } from "@/lib/otp";
import { AppError } from "@/lib/api/errors";
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
      windowMs: 15 * 60 * 1000,
    });

    const json = await req.json();
    const parsed = otpRequestSchema.safeParse(json);
    if (!parsed.success) {
      return legacyErrorResponse(
        "Invalid params",
        400,
        parsed.error.flatten().fieldErrors,
      );
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
      return legacyErrorResponse(
        result.error || "Rate limit or processing error",
        isRateLimit ? 429 : 502,
      );
    }

    return legacySuccessResponse();
  } catch (error) {
    if (error instanceof AppError) {
      return appErrorLegacyResponse(error);
    }

    logger.error("OTP", "Error requesting OTP", error);
    return legacyErrorResponse("Failed to request OTP", 500);
  }
}
