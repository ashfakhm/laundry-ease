import { getDb } from "./mongodb";
import crypto from "crypto";
import bcrypt from "bcrypt";
import twilio from "twilio";
import { env } from "./env";
import { logger } from "./logger";
import { sendOtpCodeEmailNow } from "@/lib/otp-code-email";
import { BCRYPT_SALT_ROUNDS } from "./constants";

type OtpType = "email" | "phone";

function normalizeTarget(target: string, type: OtpType): string {
  return type === "email" ? target.trim().toLowerCase() : target.trim();
}

function generateCode() {
  // secure 6 digit numeric code
  return crypto.randomInt(100000, 1000000).toString();
}

let smsClientInstance: ReturnType<typeof twilio> | null = null;

function getSmsClient() {
  if (!smsClientInstance) {
    smsClientInstance = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return smsClientInstance;
}

const MAX_OTP_REQUESTS_PER_HOUR = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;

export async function requestOtp(
  target: string,
  type: OtpType,
  ttlMinutes = 10,
) {
  const normalizedTarget = normalizeTarget(target, type);
  logger.info("OTP", `Request initiated for ${type}`, {
    target: normalizedTarget.substring(0, 4) + "***",
  });
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");

  // Rate limiting: Check requests in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRequests = await col.countDocuments({
    target: normalizedTarget,
    type,
    createdAt: { $gte: oneHourAgo },
  });

  if (recentRequests >= MAX_OTP_REQUESTS_PER_HOUR) {
    logger.warn("OTP", `Rate limit exceeded for ${type}`, {
      target: normalizedTarget.substring(0, 4) + "***",
      count: recentRequests,
    });
    return {
      ok: false,
      error: "Too many OTP requests. Please try again later.",
    };
  }

  const code = generateCode();
  const hash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

  const inserted = await col.insertOne({
    target: normalizedTarget,
    type,
    codeHash: hash,
    createdAt: now,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  try {
    if (type === "email") {
      logger.debug("OTP", `Sending OTP email directly`, {
        target: normalizedTarget.substring(0, 4) + "***",
      });
      await sendOtpCodeEmailNow({
        to: normalizedTarget,
        code,
        ttlMinutes,
      });
      logger.info("OTP", `Email sent successfully`, {
        target: normalizedTarget.substring(0, 4) + "***",
      });
    } else if (type === "phone") {
      logger.debug("OTP", `Sending SMS`, {
        target: normalizedTarget.substring(0, 4) + "***",
      });
      await getSmsClient().messages.create({
        body: `Your OTP code is ${code}. It will expire in ${ttlMinutes} minutes.`,
        from: env.TWILIO_PHONE_NUMBER,
        to: normalizedTarget,
      });
      logger.info("OTP", `SMS sent successfully`, {
        target: normalizedTarget.substring(0, 4) + "***",
      });
    }
  } catch (error) {
    await col.deleteOne({ _id: inserted.insertedId }).catch((cleanupError) => {
      logger.error("OTP", "Failed to cleanup unsent OTP record", cleanupError, {
        target: normalizedTarget.substring(0, 4) + "***",
      });
    });
    logger.error("OTP", `Failed to send OTP`, error, {
      target: normalizedTarget.substring(0, 4) + "***",
    });
    return { ok: false, error: "Failed to send OTP" };
  }

  logger.info("OTP", `Request completed for ${type}`, {
    target: normalizedTarget.substring(0, 4) + "***",
  });
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
  const normalizedTarget = normalizeTarget(target, type);
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  const doc = await col.findOne(
    { target: normalizedTarget, type, verified: false },
    { sort: { createdAt: -1 } },
  );
  if (!doc) return { ok: false, error: "No OTP found" };
  if (new Date(doc.expiresAt).getTime() < Date.now())
    return { ok: false, error: "OTP expired" };

  // Check attempt limit
  if (doc.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    logger.warn("OTP", `Max attempts exceeded for ${type}`, {
      target: normalizedTarget.substring(0, 4) + "***",
      attempts: doc.attempts,
    });
    return {
      ok: false,
      error:
        "Maximum verification attempts exceeded. Please request a new OTP.",
    };
  }

  const match = await bcrypt.compare(code, doc.codeHash);
  if (!match) {
    const newAttempts = doc.attempts + 1;
    await col.updateOne({ _id: doc._id }, { $set: { attempts: newAttempts } });
    logger.warn("OTP", `Invalid code attempt for ${type}`, {
      target: normalizedTarget.substring(0, 4) + "***",
      attempts: newAttempts,
    });
    return { ok: false, error: "Invalid code" };
  }

  await col.updateOne({ _id: doc._id }, { $set: { verified: true } });
  logger.info("OTP", `OTP verified successfully for ${type}`, {
    target: normalizedTarget.substring(0, 4) + "***",
  });
  return { ok: true };
}

export async function isOtpVerifiedRecently(
  target: string,
  type: OtpType,
  minutes = 30,
) {
  const normalizedTarget = normalizeTarget(target, type);
  logger.debug("OTP", `Checking if ${type} was verified recently`, {
    target: normalizedTarget.substring(0, 4) + "***",
    minutes,
  });
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  const since = new Date(Date.now() - minutes * 60_000);

  const doc = await col.findOne({
    target: normalizedTarget,
    type,
    verified: true,
    createdAt: { $gte: since },
  });

  if (doc) {
    logger.debug("OTP", `Verified OTP found for ${type}`, {
      target: normalizedTarget.substring(0, 4) + "***",
    });
  } else {
    logger.debug("OTP", `No verified OTP found for ${type}`, {
      target: normalizedTarget.substring(0, 4) + "***",
    });
  }

  return !!doc;
}
