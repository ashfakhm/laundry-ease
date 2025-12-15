import { getDb } from "./mongodb";
import bcrypt from "bcrypt";

type OtpType = "email" | "phone";

function generateCode() {
  // 6 digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestOtp(
  target: string,
  type: OtpType,
  ttlMinutes = 10
) {
  const db = await getDb();
  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

  const col = db.collection("otp_codes");
  // Ensure TTL index exists (expires after expiresAt)
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await col.insertOne({
    target,
    type,
    codeHash: hash,
    createdAt: now,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  // In dev, we just log the code. Integrate email/SMS provider in prod.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP] ${type} to ${target}: ${code}`);
  }

  return {
    ok: true,
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
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
  const db = await getDb();
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
  const db = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  const since = new Date(Date.now() - minutes * 60_000);
  const doc = await col.findOne(
    { target, type, verified: true, createdAt: { $gte: since } },
    { sort: { createdAt: -1 } }
  );
  return Boolean(doc);
}
