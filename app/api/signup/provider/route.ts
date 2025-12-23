import { NextRequest, NextResponse } from "next/server";
import { emailExists, createProvider } from "@/lib/db";
import { isOtpVerifiedRecently } from "@/lib/otp";
import { signupProviderSchema } from "@/lib/api/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = signupProviderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const {
    name,
    email,
    password,
    phone,
    businessName,
    bio,
    description,
    services,
    location,
    radius_km,
    per_km_rate,
    pricing,
    pricingRates,
    bankAccountHolder,
    bankAccountNumber,
    bankIFSC,
    upiId,
  } = parsed.data;

  // Require verified OTPs for email and phone
  const emailOk = await isOtpVerifiedRecently(email, "email");
  const phoneOk = await isOtpVerifiedRecently(phone, "phone");
  if (!emailOk || !phoneOk) {
    return NextResponse.json(
      { error: "Email and phone must be verified via OTP" },
      { status: 400 }
    );
  }

  // Check if email already exists in any collection
  const exists = await emailExists(email);
  if (exists) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  // Create provider in providers collection
  await createProvider({
    email,
    name,
    password,
    phone,
    businessName,
    bio,
    description,
    pricingRates,
    services,
    location,
    radius_km,
    per_km_rate,
    pricing,
    bankDetails: {
      accountHolderName: bankAccountHolder,
      accountNumber: bankAccountNumber,
      ifsc: bankIFSC,
      upiId: upiId || undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
