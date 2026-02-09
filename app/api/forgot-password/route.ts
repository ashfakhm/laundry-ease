import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserByEmail } from "@/lib/db";
import nodemailer from "nodemailer";
import { createHash, randomBytes } from "crypto";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { forgotPasswordSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

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
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
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
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");
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

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    });

    const resetUrl = `${
      env.NEXT_PUBLIC_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000"
    }/reset-password?token=${encodeURIComponent(resetToken)}`;

    await transporter.sendMail({
      from: env.EMAIL_USER,
      to: normalizedEmail,
      subject: "LaundryEase - Password Reset Request",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Password Reset Request</h2>
          <p>We received a request to reset your password. Click the link below to create a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `,
    });

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode }
      );
    }

    logger.error("AUTH", "Forgot password error", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
