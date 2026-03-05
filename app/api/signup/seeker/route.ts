import { successResponse, errorResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { emailExists, createSeeker } from "@/lib/db/index";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupSeekerSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:signup:seeker:ip",
      max: 10,
      windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
    });

    const payload = await req.json();
    const parsed = signupSeekerSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid data", parsed),
      );
    }
    const { name, email, password, phone, address, coordinates } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Require verified OTP for email
    const emailOk = await isOtpVerifiedRecently(normalizedEmail, "email");
    if (!emailOk) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Email must be verified via OTP",
        ),
      );
    }

    // Check if email already exists in any collection
    const exists = await emailExists(normalizedEmail);
    if (exists) {
      return errorResponse(
        new AppError(ErrorCode.CONFLICT, 409, "Email already in use"),
      );
    }

    // Create seeker in seekers collection
    await createSeeker({
      email: normalizedEmail,
      name,
      phone,
      password,
      address,
      coordinates,
    });

    return successResponse(
      {
        success: true,
      },
      200,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("AUTH", "Seeker signup failed", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to create account"),
    );
  }
}
