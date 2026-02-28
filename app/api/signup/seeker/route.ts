import { successResponse, errorResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";
import { emailExists, createSeeker } from "@/lib/db/index";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupSeekerSchema } from "@/lib/api/schemas";
import { AppError, ErrorCode } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = signupSeekerSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid data", parsed));
  }
  const { name, email, password, phone, address, coordinates } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Require verified OTPs for email and phone
  const emailOk = await isOtpVerifiedRecently(normalizedEmail, "email");
  const phoneOk = await isOtpVerifiedRecently(phone, "phone");
  if (!emailOk || !phoneOk) {
    return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Email and phone must be verified via OTP"));
  }

  // Check if email already exists in any collection
  const exists = await emailExists(normalizedEmail);
  if (exists) {
    return errorResponse(new AppError(ErrorCode.CONFLICT, 409, "Email already in use"));
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
