import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

const JWT_SECRET = env.NEXTAUTH_SECRET;

type EmailVerificationTokenPayload = jwt.JwtPayload & {
  email: string;
  type: string;
};

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify JWT token
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    if (typeof decoded === "string") {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 400 }
      );
    }

    if (
      typeof decoded.email !== "string" ||
      typeof decoded.type !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 400 }
      );
    }

    const payload = decoded as EmailVerificationTokenPayload;

    const { email, type } = payload;

    if (type !== "email_verification") {
      return NextResponse.json(
        { error: "Invalid token type" },
        { status: 400 }
      );
    }

    const { db } = await getDb();

    // Check if user exists in seekers or providers
    const seeker = await db.collection("seekers").findOne({ email });
    const provider = await db.collection("providers").findOne({ email });

    if (!seeker && !provider) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update emailVerified flag
    if (seeker) {
      await db.collection("seekers").updateOne(
        { email },
        { $set: { emailVerified: true } }
      );
    }

    if (provider) {
      await db.collection("providers").updateOne(
        { email },
        { $set: { emailVerified: true } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("AUTH", "Email verification error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
