import { successResponse } from "@/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { emailExists, createSeeker } from "@/lib/db/index";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupSeekerSchema } from "@/lib/api/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = signupSeekerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: "Invalid data",
      details: parsed.error.flatten()
    }, {
      status: 400
    });
  }
  const { name, email, password, phone, address, coordinates } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Require verified OTPs for email and phone
  const emailOk = await isOtpVerifiedRecently(normalizedEmail, "email");
  const phoneOk = await isOtpVerifiedRecently(phone, "phone");
  if (!emailOk || !phoneOk) {
    return NextResponse.json({
      success: false,
      error: "Email and phone must be verified via OTP"
    }, {
      status: 400
    });
  }

  // Check if email already exists in any collection
  const exists = await emailExists(normalizedEmail);
  if (exists) {
    return NextResponse.json({
      success: false,
      error: "Email already in use"
    }, {
      status: 409
    });
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

  return successResponse({
    success: true
  }, 200);
}
