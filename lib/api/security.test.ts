import { afterEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  TRUST_PROXY: "true",
  NEXT_PUBLIC_APP_URL: "https://laundryease.test",
  NEXT_PUBLIC_BASE_URL: "https://laundryease.test",
  NEXTAUTH_URL: "https://laundryease.test",
  CSP_ENFORCE: "false",
  CSP_ALLOW_UNSAFE_EVAL: "false",
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

// Undo the global requireSameOrigin mock so we test the real implementation
vi.unmock("@/lib/api/security");

import {
  collectAllowedOrigins,
  extractClientIp,
  requireSameOrigin,
} from "./security";

afterEach(() => {
  mockEnv.TRUST_PROXY = "true";
  mockEnv.NEXT_PUBLIC_APP_URL = "https://laundryease.test";
});

describe("extractClientIp", () => {
  it("uses the first x-forwarded-for value", () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.8",
      },
    });

    expect(extractClientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        "x-real-ip": "198.51.100.99",
      },
    });

    expect(extractClientIp(req)).toBe("198.51.100.99");
  });
});

describe("collectAllowedOrigins", () => {
  it("includes request origin and configured public app url", () => {
    mockEnv.NEXT_PUBLIC_APP_URL = "https://app.laundryease.test";

    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
    });
    const origins = collectAllowedOrigins(req);

    expect(origins).toContain("https://laundryease.test");
    expect(origins).toContain("https://app.laundryease.test");
  });
});

describe("requireSameOrigin", () => {
  it("allows safe methods without origin headers", async () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "GET",
    });

    await expect(requireSameOrigin(req)).resolves.toBeUndefined();
  });

  it("allows POST when origin matches request host", async () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        origin: "https://laundryease.test",
      },
    });

    await expect(requireSameOrigin(req)).resolves.toBeUndefined();
  });

  it("allows referer origin when origin header is missing", async () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        referer: "https://laundryease.test/dashboard",
      },
    });

    await expect(requireSameOrigin(req)).resolves.toBeUndefined();
  });

  it("allows same-origin fetch metadata fallback when origin and referer are missing", async () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        "sec-fetch-site": "same-origin",
      },
    });

    await expect(requireSameOrigin(req)).resolves.toBeUndefined();
  });

  it("rejects POST from untrusted origin", async () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    await expect(requireSameOrigin(req)).rejects.toMatchObject({
      statusCode: 403,
      message: "Invalid request origin",
    });
  });

  it("rejects missing origin when fetch metadata is not same-origin", async () => {
    const req = new Request("https://laundryease.test/api/bookings", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
      },
    });

    await expect(requireSameOrigin(req)).rejects.toMatchObject({
      statusCode: 403,
      message: "Missing request origin",
    });
  });
});
