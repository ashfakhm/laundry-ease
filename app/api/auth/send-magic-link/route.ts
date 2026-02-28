import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { SignJWT } from "jose";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

const JWT_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);
const BASE_URL =
  env.NEXTAUTH_URL || env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const sendMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
});

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:send-magic-link:ip",
      max: 10,
      windowMs: 15 * 60 * 1000,
    });

    const payload = await req.json();
    const parsed = sendMagicLinkSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid email is required",
        },
        {
          status: 400,
        },
      );
    }
    const email = parsed.data.email;

    const { db } = await getDb();

    // Check if user exists
    const seeker = await db.collection("seekers").findOne({ email });
    const provider = await db.collection("providers").findOne({ email });

    if (!seeker && !provider) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        {
          status: 404,
        },
      );
    }

    // Generate JWT token (valid for 24 hours) using jose
    const token = await new SignJWT({ email, type: "email_verification" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const verificationLink = `${BASE_URL}/verify-email?token=${token}`;

    await enqueueEmailOutboxJob({
      kind: "magic_link",
      payload: {
        to: email,
        verificationLink,
      },
    });

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,

          ...(error.details
            ? {
                details: error.details,
              }
            : {}),
        },
        {
          status: error.statusCode || 400,
        },
      );
    }

    logger.error("AUTH", "Send magic link error", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send verification email",
      },
      {
        status: 500,
      },
    );
  }
}
