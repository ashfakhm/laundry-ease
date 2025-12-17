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
  address: z.object({
    line1: z.string().min(3),
    city: z.string().min(2),
    state: z.string().min(2),
    country: z.string().min(2),
    postalCode: z.string().min(3),
    landmark: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const { name, email, password, phone, address } = parsed.data;

  // Require verified OTPs for email and phone
  const emailOk = await isOtpVerifiedRecently(email, "email");
  const phoneOk = await isOtpVerifiedRecently(phone, "phone");
  if (!emailOk || !phoneOk) {
    return NextResponse.json(
      { error: "Email and phone must be verified via OTP" },
      { status: 400 }
    );
  }

  const { db } = await getDb();
  const users = db.collection("users");

  const existing = await users.findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  await users.insertOne({
    email,
    role: "seeker",
    name,
    phone,
    emailVerified: true,
    phoneVerified: true,
    address,
    passwordHash,
    createdAt: now,
  });

  return NextResponse.json({ ok: true });
}
