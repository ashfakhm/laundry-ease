import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

const JWT_SECRET = env.NEXTAUTH_SECRET;
const BASE_URL = env.NEXTAUTH_URL || env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const emailTransporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

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

    // Send email
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Email - LaundryEase",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email</h2>
          <p>Click the button below to verify your email address:</p>
          <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("AUTH", "Send magic link error", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
