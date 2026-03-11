import { vi } from "vitest";

// Default env mock — provides all required env vars so that
// `lib/env.ts` Zod validation doesn't crash when modules are imported
// during test setup. Individual test files can override specific values
// by calling vi.mock("@/lib/env", ...) with their own values.
vi.mock("@/lib/env", () => ({
  env: {
    AUTH_GOOGLE_ID: "test-google-id",
    AUTH_GOOGLE_SECRET: "test-google-secret",
    GOOGLE_ID: "test-google-id",
    GOOGLE_SECRET: "test-google-secret",
    MONGODB_URI: "mongodb://localhost:27017/test",
    MONGODB_DB: "laundryease-test",
    EMAIL_USER: "test@test.com",
    EMAIL_PASS: "test-pass",
    TWILIO_ACCOUNT_SID: "ACtest",
    TWILIO_AUTH_TOKEN: "test-auth-token",
    TWILIO_PHONE_NUMBER: "+1234567890",
    RAZORPAY_KEY_ID: "rzp_test_key",
    RAZORPAY_KEY_SECRET: "rzp_test_secret",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_key",
    RAZORPAYX_ACCOUNT_NUMBER: "",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test-maps-key",
    CRON_SECRET: "test-cron-secret",
    AUTH_SECRET: "test-nextauth-secret",
    AUTH_URL: "https://laundryease.test",
    AUTH_TRUST_HOST: "false",
    NEXTAUTH_SECRET: "test-nextauth-secret",
    NEXTAUTH_URL: "https://laundryease.test",
    NEXT_PUBLIC_BASE_URL: "https://laundryease.test",
    NEXT_PUBLIC_APP_URL: "https://laundryease.test",
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-cloud-key",
    CLOUDINARY_API_SECRET: "test-cloud-secret",
    DATADOG_API_KEY: "",
    DD_API_KEY: "",
    OPS_ALERT_EMAIL_TO: "",
    OPS_ALERT_WEBHOOK_URL: "",
    OPS_ALERT_WEBHOOK_BEARER: "",
    CSP_ENFORCE: "false",
    CSP_ALLOW_UNSAFE_EVAL: "false",
    ADMIN_ALLOWLIST_IPS: "",
    TRUST_PROXY: "false",
    DEBUG_LOGGING: "false",
    E2E_FAKE_PAYMENTS: "0",
    DEMO_MODE: "0",
    PROVIDER_SEARCH_DEBUG: "false",
    ALLOW_BASE64_UPLOAD_FALLBACK: "0",
    ALLOW_START_WITH_INDEX_ERRORS: "0",
  },
}));

// Mock requireSameOrigin globally — CSRF origin checks should not block unit tests.
// Tests that specifically test CSRF behavior can override this mock.
vi.mock("@/lib/api/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/security")>();
  return {
    ...actual,
    requireSameOrigin: vi.fn().mockResolvedValue(undefined),
  };
});
