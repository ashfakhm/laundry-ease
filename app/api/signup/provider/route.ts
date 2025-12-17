import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailExists, createProvider } from "@/lib/db";
import { isOtpVerifiedRecently } from "@/lib/otp";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(8),
  businessName: z.string().min(1),
  bio: z.string().min(1).max(200),
  description: z.string().min(1),
  pricingRates: z.record(z.string(), z.number().nonnegative()),
  tags: z.array(z.string()).min(1),
  location: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const {
    name,
    email,
    password,
    phone,
    businessName,
    bio,
    description,
    pricingRates,
    tags,
    location,
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

  // Create provider in providers collection with business details
  await createProvider({
    email,
    name,
    phone,
    password,
    services: tags, // tags as services
    location,
  });

  return NextResponse.json({ ok: true });
}
