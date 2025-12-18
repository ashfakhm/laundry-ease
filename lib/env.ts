import { z } from "zod";

const envSchema = z.object({
  // OAuth
  GOOGLE_ID: z.string().min(1),
  GOOGLE_SECRET: z.string().min(1),

  // Database
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default("laundryease"),

  // Email (OTP)
  EMAIL_USER: z.string().min(1),
  EMAIL_PASS: z.string().min(1),

  // SMS (OTP)
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
});

export const env = envSchema.parse(process.env);
