import { NextRequest } from "next/server";
import {
  legacyErrorResponse,
  legacySuccessResponse,
} from "@/lib/api/legacy-response";
import { emailExists, createSeeker } from "@/lib/db/index";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupSeekerSchema } from "@/lib/api/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = signupSeekerSchema.safeParse(payload);
  if (!parsed.success) {
    return legacyErrorResponse("Invalid data", 400, parsed.error.flatten());
  }
  const { name, email, password, phone, address, coordinates } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Require verified OTPs for email and phone
  const emailOk = await isOtpVerifiedRecently(normalizedEmail, "email");
  const phoneOk = await isOtpVerifiedRecently(phone, "phone");
  if (!emailOk || !phoneOk) {
    return legacyErrorResponse("Email and phone must be verified via OTP", 400);
  }

  // Check if email already exists in any collection
  const exists = await emailExists(normalizedEmail);
  if (exists) {
    return legacyErrorResponse("Email already in use", 409);
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

  return legacySuccessResponse();
}
