import { successResponse, errorResponse } from "@/lib/api/response";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { getDb } from "@/lib/mongodb";
import { SignJWT } from "jose";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { enqueueEmailOutboxJob } from "@/lib/email-outbox";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

const JWT_SECRET = new TextEncoder().encode(env.AUTH_SECRET);
const BASE_URL =
  env.AUTH_URL || env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const sendMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
});

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:send-magic-link:ip",
      max: 10,
      windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
    });

    const payload = await req.json();
    const parsed = sendMagicLinkSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Valid email is required",
        ),
      );
    }
    const email = parsed.data.email;

    const { db } = await getDb();

    const seeker = await db.collection("seekers").findOne({ email });
    const provider = await db.collection("providers").findOne({ email });

    if (!seeker && !provider) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "User not found"),
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

    return successResponse({});
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("AUTH", "Send magic link error", error);
    return errorResponse(
      new AppError(
        ErrorCode.INTERNAL_ERROR,
        500,
        "Failed to send verification email",
      ),
    );
  }
}
