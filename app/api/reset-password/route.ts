import { NextRequest, NextResponse } from "next/server";
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
import { AppError } from "@/lib/api/errors";
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
      windowMs: 15 * 60 * 1000,
    });

    const payload = await req.json();
    const parsed = resetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: "Token and password are required"
      }, {
        status: 400
      });
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
      return NextResponse.json({
        success: false,
        error: PASSWORD_POLICY_MESSAGE
      }, {
        status: 400
      });
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
      return NextResponse.json({
        success: false,
        error: "Invalid or expired reset link"
      }, {
        status: 400
      });
    }

    const collection = roleToCollection(resetDoc.role);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const userUpdate = await db.collection(collection).updateOne(
      { _id: resetDoc.userId },
      {
        $set: {
          passwordHash,
          updatedAt: now,
        },
      }
    );

    if (userUpdate.modifiedCount === 0) {
      return NextResponse.json({
        success: false,
        error: "Could not update password"
      }, {
        status: 400
      });
    }

    await db.collection("password_reset_tokens").updateOne(
      { _id: resetDoc._id },
      {
        $set: {
          usedAt: now,
        },
      }
    );

    // Invalidate all other active reset tokens for this user.
    await db.collection("password_reset_tokens").updateMany(
      {
        userId: resetDoc.userId,
        usedAt: { $in: [null, undefined] },
      },
      {
        $set: { usedAt: now },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Password reset successful"
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

    logger.error("AUTH", "Reset password error", error);
    return NextResponse.json({
      success: false,
      error: "An error occurred. Please try again later."
    }, {
      status: 500
    });
  }
}
