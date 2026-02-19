import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json(
        { error: "Invalid params", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { target, type, code } = parsed.data;
    const res = await verifyOtp(target, type, code);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("OTP", "Error verifying OTP", error);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 },
    );
  }
}
