import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { Role } from "@/types/enums";
import { ObjectId } from "mongodb";

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
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return NextResponse.json(
        {
          error:
            "Password must contain at least one uppercase letter, one number, and one special character",
        },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { db } = await getDb();

    const resetDoc = await db
      .collection<PasswordResetTokenDoc>("password_reset_tokens")
      .findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
        usedAt: { $in: [null, undefined] },
      });

    if (!resetDoc) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Could not update password" },
        { status: 400 }
      );
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

    return NextResponse.json(
      { message: "Password reset successful" },
      { status: 200 }
    );
  } catch (error) {
    logger.error("AUTH", "Reset password error", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
