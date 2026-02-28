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

  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAYX_ACCOUNT_NUMBER: z.string().min(1).optional().or(z.literal("")),

  // Google Maps API
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),

  // Cron Security
  CRON_SECRET: z.string().min(1),

  // NextAuth (required for JWT signing)
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),

  // Application URLs (optional, have defaults in code)
  NEXT_PUBLIC_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),

  // Cloudinary (optional, has fallback)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // APM / Telemetry (optional)
  DATADOG_API_KEY: z.string().optional(),
  DD_API_KEY: z.string().optional(),

  // Operational alert notifications (optional)
  OPS_ALERT_EMAIL_TO: z.string().optional().or(z.literal("")),
  OPS_ALERT_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  OPS_ALERT_WEBHOOK_BEARER: z.string().optional().or(z.literal("")),

  // Security Hardening
  CSP_ENFORCE: z.enum(["true", "false"]).optional().default("false"),
  ADMIN_ALLOWLIST_IPS: z.string().optional().or(z.literal("")),
  TRUST_PROXY: z.enum(["true", "false"]).optional().default("false"),
  DEBUG_LOGGING: z.enum(["true", "false"]).optional().default("false"),
});

export const env = envSchema.parse(process.env);
