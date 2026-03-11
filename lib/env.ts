import { z } from "zod";

const envSchema = z.object({
  // OAuth
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
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
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.enum(["true", "false"]).optional().default("false"),
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
  OPS_PAGERDUTY_ROUTING_KEY: z.string().optional().or(z.literal("")),

  // Security Hardening
  CSP_ENFORCE: z.enum(["true", "false"]).optional().default("false"),
  CSP_ALLOW_UNSAFE_EVAL: z.enum(["true", "false"]).optional().default("false"),
  ADMIN_ALLOWLIST_IPS: z.string().optional().or(z.literal("")),
  TRUST_PROXY: z.enum(["true", "false"]).optional().default("false"),
  DEBUG_LOGGING: z.enum(["true", "false"]).optional().default("false"),

  // Feature Flags / Development
  E2E_FAKE_PAYMENTS: z.enum(["0", "1"]).optional().default("0"),
  DEMO_MODE: z.enum(["0", "1"]).optional().default("0"),
  PROVIDER_SEARCH_DEBUG: z.enum(["true", "false"]).optional().default("false"),
  ALLOW_BASE64_UPLOAD_FALLBACK: z.enum(["0", "1"]).optional().default("0"),
  ALLOW_START_WITH_INDEX_ERRORS: z.enum(["0", "1"]).optional().default("0"),
});

let _env: z.infer<typeof envSchema> | null = null;

function normalizeProcessEnv(rawEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...rawEnv,
    AUTH_GOOGLE_ID: rawEnv.AUTH_GOOGLE_ID ?? rawEnv.GOOGLE_ID,
    AUTH_GOOGLE_SECRET: rawEnv.AUTH_GOOGLE_SECRET ?? rawEnv.GOOGLE_SECRET,
    GOOGLE_ID: rawEnv.GOOGLE_ID ?? rawEnv.AUTH_GOOGLE_ID,
    GOOGLE_SECRET: rawEnv.GOOGLE_SECRET ?? rawEnv.AUTH_GOOGLE_SECRET,
    AUTH_SECRET: rawEnv.AUTH_SECRET ?? rawEnv.NEXTAUTH_SECRET,
    NEXTAUTH_SECRET: rawEnv.NEXTAUTH_SECRET ?? rawEnv.AUTH_SECRET,
    AUTH_URL: rawEnv.AUTH_URL ?? rawEnv.NEXTAUTH_URL,
    NEXTAUTH_URL: rawEnv.NEXTAUTH_URL ?? rawEnv.AUTH_URL,
    AUTH_TRUST_HOST: rawEnv.AUTH_TRUST_HOST ?? "false",
  };
}

function getEnv(): z.infer<typeof envSchema> {
  if (!_env) {
    _env = envSchema.parse(normalizeProcessEnv(process.env));
  }
  return _env;
}

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof z.infer<typeof envSchema>];
  },
});
