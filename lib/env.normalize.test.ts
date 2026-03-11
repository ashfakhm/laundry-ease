import { beforeEach, describe, expect, it, vi } from "vitest";

describe("normalizeProcessEnv", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unmock("@/lib/env");
  });

  it("falls back to AUTH_* values when legacy aliases are present but blank", async () => {
    const { normalizeProcessEnv } = await import("./env");
    const normalized = normalizeProcessEnv({
      NODE_ENV: "test",
      AUTH_GOOGLE_ID: "auth-google-id",
      AUTH_GOOGLE_SECRET: "auth-google-secret",
      AUTH_SECRET: "auth-secret",
      AUTH_URL: "https://laundryease.test",
      GOOGLE_ID: "",
      GOOGLE_SECRET: "   ",
      NEXTAUTH_SECRET: "",
      NEXTAUTH_URL: "   ",
    } as NodeJS.ProcessEnv);

    expect(normalized.AUTH_GOOGLE_ID).toBe("auth-google-id");
    expect(normalized.GOOGLE_ID).toBe("auth-google-id");
    expect(normalized.AUTH_GOOGLE_SECRET).toBe("auth-google-secret");
    expect(normalized.GOOGLE_SECRET).toBe("auth-google-secret");
    expect(normalized.AUTH_SECRET).toBe("auth-secret");
    expect(normalized.NEXTAUTH_SECRET).toBe("auth-secret");
    expect(normalized.AUTH_URL).toBe("https://laundryease.test");
    expect(normalized.NEXTAUTH_URL).toBe("https://laundryease.test");
  });

  it("still backfills legacy aliases into AUTH_* names during transition", async () => {
    const { normalizeProcessEnv } = await import("./env");
    const normalized = normalizeProcessEnv({
      NODE_ENV: "test",
      GOOGLE_ID: "legacy-google-id",
      GOOGLE_SECRET: "legacy-google-secret",
      NEXTAUTH_SECRET: "legacy-secret",
      NEXTAUTH_URL: "https://legacy.laundryease.test",
    } as NodeJS.ProcessEnv);

    expect(normalized.AUTH_GOOGLE_ID).toBe("legacy-google-id");
    expect(normalized.AUTH_GOOGLE_SECRET).toBe("legacy-google-secret");
    expect(normalized.AUTH_SECRET).toBe("legacy-secret");
    expect(normalized.AUTH_URL).toBe("https://legacy.laundryease.test");
  });
});
