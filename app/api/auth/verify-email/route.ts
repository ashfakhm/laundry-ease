import { NextResponse } from "next/server";
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
      return NextResponse.json(
        {
          success: false,
          error: "Token is required",
        },
        {
          status: 400,
        },
      );
    }

    // Verify JWT token using jose
    let decoded: EmailVerificationTokenPayload;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      decoded = payload as EmailVerificationTokenPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !decoded ||
      typeof decoded.email !== "string" ||
      typeof decoded.type !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid token payload",
        },
        {
          status: 400,
        },
      );
    }

    const { email, type } = decoded;

    if (type !== "email_verification") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid token type",
        },
        {
          status: 400,
        },
      );
    }

    const { db } = await getDb();

    // Check if user exists in seekers or providers
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

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    logger.error("AUTH", "Email verification error", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}
