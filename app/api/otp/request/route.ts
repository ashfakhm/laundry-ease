import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({
        success: false,
        error: "Invalid params",
        details: parsed.error.flatten().fieldErrors
      }, {
        status: 400
      });
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
      return NextResponse.json({
        success: false,
        error: result.error || "Rate limit or processing error"
      }, {
        status: isRateLimit ? 429 : 502
      });
    }

    return NextResponse.json({
      success: true
    }, {
      status: 200
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message,

        ...(error.details ? {
          details: error.details
        } : {})
      }, {
        status: error.statusCode || 400
      });
    }

    logger.error("OTP", "Error requesting OTP", error);
    return NextResponse.json({
      success: false,
      error: "Failed to request OTP"
    }, {
      status: 500
    });
  }
}
