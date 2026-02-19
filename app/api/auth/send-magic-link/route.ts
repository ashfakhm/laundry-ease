import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";
import { AppError } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

const JWT_SECRET = env.NEXTAUTH_SECRET;
const BASE_URL = env.NEXTAUTH_URL || env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const sendMagicLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Valid email is required"),
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
        { error: "Valid email is required" },
        { status: 400 }
      );
    }
    const email = parsed.data.email;

    const { db } = await getDb();

    // Check if user exists
    const seeker = await db.collection("seekers").findOne({ email });
    const provider = await db.collection("providers").findOne({ email });

    if (!seeker && !provider) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Generate JWT token (valid for 24 hours)
    const token = jwt.sign(
      { email, type: "email_verification" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verificationLink = `${BASE_URL}/verify-email?token=${token}`;

    await enqueueEmailOutboxJob({
      kind: "magic_link",
      payload: {
        to: email,
        verificationLink,
      },
    });

    return NextResponse.json({ success: true });
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

    logger.error("AUTH", "Send magic link error", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
