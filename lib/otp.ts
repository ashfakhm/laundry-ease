import { getDb } from "./mongodb";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import twilio from "twilio";

type OtpType = "email" | "phone";

function generateCode() {
  // 6 digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const emailTransporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  debug: true, // Enable debug mode
  logger: true, // Log information
});

const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function requestOtp(
  target: string,
  type: OtpType,
  ttlMinutes = 10
) {
  console.log(`[OTP] Request initiated for ${type} to ${target}`);
  const { db } = await getDb();
  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

  const col = db.collection("otp_codes");
  await col.insertOne({
    target,
    type,
    codeHash: hash,
    createdAt: now,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  try {
    if (type === "email") {
      console.log(`[OTP] Sending email to ${target}`);
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: target,
        subject: "Your OTP Code",
        text: `Your OTP code is ${code}. It will expire in ${ttlMinutes} minutes.`,
      });
      console.log(`[OTP] Email sent successfully to ${target}`);
    } else if (type === "phone") {
      console.log(`[OTP] Sending SMS to ${target}`);
      await smsClient.messages.create({
        body: `Your OTP code is ${code}. It will expire in ${ttlMinutes} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: target,
      });
      console.log(`[OTP] SMS sent successfully to ${target}`);
    }
  } catch (error) {
    console.error(`[OTP] Failed to send OTP to ${target}:`, error);
    return { ok: false, error: "Failed to send OTP" };
  }

  console.log(`[OTP] Request completed for ${type} to ${target}`);
  return {
    ok: true,
  };
}

type OtpRecord = {
  target: string;
  type: OtpType;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
};

export async function verifyOtp(target: string, type: OtpType, code: string) {
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  const doc = await col.findOne(
    { target, type, verified: false },
    { sort: { createdAt: -1 } }
  );
  if (!doc) return { ok: false, error: "No OTP found" };
  if (new Date(doc.expiresAt).getTime() < Date.now())
    return { ok: false, error: "OTP expired" };

  const match = await bcrypt.compare(code, doc.codeHash);
  if (!match) {
    await col.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    return { ok: false, error: "Invalid code" };
  }

  await col.updateOne({ _id: doc._id }, { $set: { verified: true } });
  return { ok: true };
}

export async function isOtpVerifiedRecently(
  target: string,
  type: OtpType,
  minutes = 30
) {
  console.log(
    `[OTP] Verifying if ${type} for ${target} was verified in the last ${minutes} minutes.`
  );
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  const since = new Date(Date.now() - minutes * 60_000);

  const doc = await col.findOne({
    target,
    type,
    verified: true,
    createdAt: { $gte: since },
  });

  if (doc) {
    console.log(`[OTP] Verified OTP found for ${type} to ${target}.`);
  } else {
    console.log(`[OTP] No verified OTP found for ${type} to ${target}.`);
  }

  return !!doc;
}
