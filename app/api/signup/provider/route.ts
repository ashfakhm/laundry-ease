import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import bcrypt from "bcrypt";
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

  const db = await getDb();
  const users = db.collection("users");

  const existing = await users.findOne({ $or: [{ email }] });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const userRes = await users.insertOne({
    email,
    role: "provider",
    name,
    phone,
    emailVerified: true,
    phoneVerified: true,
    passwordHash,
    createdAt: now,
  });

  // Create provider profile
  const providers = db.collection("providers");
  await providers.insertOne({
    userId: userRes.insertedId,
    businessName,
    bio,
    description,
    pricingRates,
    tags,
    location,
    createdAt: now,
  });

  return NextResponse.json({ ok: true });
}
