import { NextRequest } from "next/server";
import { RATE_LIMIT_AUTH_WINDOW_MS } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getDb } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { resetPasswordSchema } from "@/lib/api/schemas";

type PasswordResetTokenDoc = {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  role: Role;
  expiresAt: Date | string;
  usedAt?: Date | null;
};

function roleToCollection(role: Role): "seekers" | "providers" | "admins" {
  if (role === Role.SEEKER) return "seekers";
  if (role === Role.PROVIDER) return "providers";
  return "admins";
}

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "auth:reset-password:ip",
      max: 15,
      windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
    });

    const payload = await req.json();
    const parsed = resetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Token and password are required"));
    }

    const { token, password } = parsed.data;

    const tokenHash = createHash("sha256").update(token).digest("hex");
    await enforceRateLimit(req, {
      bucket: "auth:reset-password:token",
      max: 6,
      windowMs: 60 * 60 * 1000,
      identifier: tokenHash.slice(0, 24),
    });

    if (!isStrongPassword(password)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, PASSWORD_POLICY_MESSAGE));
    }

    const { db } = await getDb();

    const resetDoc = await db
      .collection<PasswordResetTokenDoc>("password_reset_tokens")
      .findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
        usedAt: { $in: [null, undefined] },
      });

    if (!resetDoc) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid or expired reset link"));
    }

    const collection = roleToCollection(resetDoc.role);
    const { BCRYPT_SALT_ROUNDS } = await import("@/lib/constants");
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();

    const userUpdate = await db.collection(collection).updateOne(
      { _id: resetDoc.userId },
      {
        $set: {
          passwordHash,
          updatedAt: now,
        },
      },
    );

    if (userUpdate.modifiedCount === 0) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Could not update password"));
    }

    await db.collection("password_reset_tokens").updateOne(
      { _id: resetDoc._id },
      {
        $set: {
          usedAt: now,
        },
      },
    );

    // Invalidate all other active reset tokens for this user.
    await db.collection("password_reset_tokens").updateMany(
      {
        userId: resetDoc.userId,
        usedAt: { $in: [null, undefined] },
      },
      {
        $set: { usedAt: now },
      },
    );

    return successResponse({ message: "Password reset successful" });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("AUTH", "Reset password error", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "An error occurred. Please try again later."));
  }
}
