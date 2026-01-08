import { getDb } from "./mongodb";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { env } from "./env";
import { logger } from "./logger";

type OtpType = "email" | "phone";

function generateCode() {
  // 6 digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const emailTransporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
  debug: process.env.NODE_ENV === "development",
  logger: process.env.NODE_ENV === "development",
});

const smsClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

const MAX_OTP_REQUESTS_PER_HOUR = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;

export async function requestOtp(
  target: string,
  type: OtpType,
  ttlMinutes = 10
) {
  logger.info("OTP", `Request initiated for ${type}`, {
    target: target.substring(0, 4) + "***",
  });
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  
  // Rate limiting: Check requests in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRequests = await col.countDocuments({
    target,
    type,
    createdAt: { $gte: oneHourAgo },
  });

  if (recentRequests >= MAX_OTP_REQUESTS_PER_HOUR) {
    logger.warn("OTP", `Rate limit exceeded for ${type}`, {
      target: target.substring(0, 4) + "***",
      count: recentRequests,
    });
    return {
      ok: false,
      error: "Too many OTP requests. Please try again later.",
    };
  }

  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

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
      logger.debug("OTP", `Sending email`, {
        target: target.substring(0, 4) + "***",
      });
      await emailTransporter.sendMail({
        from: env.EMAIL_USER,
        to: target,
        subject: "Your OTP Code",
        text: `Your OTP code is ${code}. It will expire in ${ttlMinutes} minutes.`,
      });
      logger.info("OTP", `Email sent successfully`, {
        target: target.substring(0, 4) + "***",
      });
    } else if (type === "phone") {
      logger.debug("OTP", `Sending SMS`, {
        target: target.substring(0, 4) + "***",
      });
      await smsClient.messages.create({
        body: `Your OTP code is ${code}. It will expire in ${ttlMinutes} minutes.`,
        from: env.TWILIO_PHONE_NUMBER,
        to: target,
      });
      logger.info("OTP", `SMS sent successfully`, {
        target: target.substring(0, 4) + "***",
      });
    }
  } catch (error) {
    logger.error("OTP", `Failed to send OTP`, error, {
      target: target.substring(0, 4) + "***",
    });
    return { ok: false, error: "Failed to send OTP" };
  }

  logger.info("OTP", `Request completed for ${type}`, {
    target: target.substring(0, 4) + "***",
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
  const { db } = await getDb();
  const col = db.collection<OtpRecord>("otp_codes");
  const doc = await col.findOne(
    { target, type, verified: false },
    { sort: { createdAt: -1 } }
  );
  if (!doc) return { ok: false, error: "No OTP found" };
  if (new Date(doc.expiresAt).getTime() < Date.now())
    return { ok: false, error: "OTP expired" };

  // Check attempt limit
  if (doc.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    logger.warn("OTP", `Max attempts exceeded for ${type}`, {
      target: target.substring(0, 4) + "***",
      attempts: doc.attempts,
    });
    return { ok: false, error: "Maximum verification attempts exceeded. Please request a new OTP." };
  }

  const match = await bcrypt.compare(code, doc.codeHash);
  if (!match) {
    const newAttempts = doc.attempts + 1;
    await col.updateOne({ _id: doc._id }, { $set: { attempts: newAttempts } });
    logger.warn("OTP", `Invalid code attempt for ${type}`, {
      target: target.substring(0, 4) + "***",
      attempts: newAttempts,
    });
    return { ok: false, error: "Invalid code" };
  }

  await col.updateOne({ _id: doc._id }, { $set: { verified: true } });
  logger.info("OTP", `OTP verified successfully for ${type}`, {
    target: target.substring(0, 4) + "***",
  });
  return { ok: true };
}

export async function isOtpVerifiedRecently(
  target: string,
  type: OtpType,
  minutes = 30
) {
  logger.debug("OTP", `Checking if ${type} was verified recently`, {
    target: target.substring(0, 4) + "***",
    minutes,
  });
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
    logger.debug("OTP", `Verified OTP found for ${type}`, {
      target: target.substring(0, 4) + "***",
    });
  } else {
    logger.debug("OTP", `No verified OTP found for ${type}`, {
      target: target.substring(0, 4) + "***",
    });
  }

  return !!doc;
}
