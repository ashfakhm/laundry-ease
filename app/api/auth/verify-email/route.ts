import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { jwtVerify, JWTPayload } from "jose";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

const JWT_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);

type EmailVerificationTokenPayload = JWTPayload & {
  email?: string;
  type?: string;
};

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Token is required"),
      );
    }

    // Verify JWT token using jose
    let decoded: EmailVerificationTokenPayload;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      decoded = payload as EmailVerificationTokenPayload;
    } catch {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid or expired token",
        ),
      );
    }

    if (
      !decoded ||
      typeof decoded.email !== "string" ||
      typeof decoded.type !== "string"
    ) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid token payload"),
      );
    }

    const { email, type } = decoded;

    if (type !== "email_verification") {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid token type"),
      );
    }

    const { db } = await getDb();

    // Check if user exists in seekers or providers
    const seeker = await db.collection("seekers").findOne({ email });
    const provider = await db.collection("providers").findOne({ email });

    if (!seeker && !provider) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "User not found"),
      );
    }

    // Update emailVerified flag
    if (seeker) {
      await db
        .collection("seekers")
        .updateOne({ email }, { $set: { emailVerified: true } });
    }

    if (provider) {
      await db
        .collection("providers")
        .updateOne({ email }, { $set: { emailVerified: true } });
    }

    return successResponse({});
  } catch (error) {
    logger.error("AUTH", "Email verification error", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
