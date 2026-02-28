import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserByEmail } from "@/lib/db/index";
import { createHash, randomBytes } from "crypto";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { forgotPasswordSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";

const GENERIC_RESPONSE = {
  message: "If an account exists, a reset link has been sent.",
};

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:forgot-password:ip",
      max: 10,
      windowMs: 15 * 60 * 1000,
    });

    const payload = await req.json();
    const parsed = forgotPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Valid email is required"
      }, {
        status: 400
      });
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const emailFingerprint = createHash("sha256")
      .update(normalizedEmail)
      .digest("hex")
      .slice(0, 24);

    await enforceRateLimit(req, {
      bucket: "auth:forgot-password:email",
      max: 4,
      windowMs: 60 * 60 * 1000,
      identifier: emailFingerprint,
    });

    const user = await getUserByEmail(normalizedEmail);

    // Keep response generic to avoid account enumeration.
    if (!user?._id || !user.passwordHash) {
      return NextResponse.json({
        success: true,
        message: GENERIC_RESPONSE.message
      }, {
        status: 200
      });
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    const { db } = await getDb();
    await db.collection("password_reset_tokens").insertOne({
      email: normalizedEmail,
      userId: user._id,
      role: user.role,
      tokenHash: resetTokenHash,
      expiresAt,
      createdAt: new Date(),
      usedAt: null,
    });

    const resetUrl = `${
      env.NEXT_PUBLIC_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000"
    }/reset-password?token=${encodeURIComponent(resetToken)}`;

    await enqueueEmailOutboxJob({
      kind: "password_reset",
      payload: {
        to: normalizedEmail,
        resetUrl,
      },
    });

    return NextResponse.json({
      success: true,
      message: GENERIC_RESPONSE.message
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

    logger.error("AUTH", "Forgot password error", error);
    return NextResponse.json({
      success: false,
      error: "An error occurred. Please try again later."
    }, {
      status: 500
    });
  }
}
