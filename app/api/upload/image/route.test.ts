import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockOptionalAuth, mockRequireSameOrigin, mockEnforceRateLimit, mockEnv } =
  vi.hoisted(() => ({
    mockOptionalAuth: vi.fn(),
    mockRequireSameOrigin: vi.fn(),
    mockEnforceRateLimit: vi.fn(),
    mockEnv: {
      CLOUDINARY_CLOUD_NAME: "test-cloud",
      CLOUDINARY_API_KEY: "test-cloud-key",
      CLOUDINARY_API_SECRET: "test-cloud-secret",
      ALLOW_BASE64_UPLOAD_FALLBACK: "0",
    } as Record<string, string>,
  }));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/api/auth", () => ({
  optionalAuth: mockOptionalAuth,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeRequest(file: File, folder?: string) {
  const formData = new FormData();
  formData.set("file", file);
  if (folder) {
    formData.set("folder", folder);
  }
  return new NextRequest("https://laundryease.test/api/upload/image", {
    method: "POST",
    headers: {
      origin: "https://laundryease.test",
    },
    body: formData,
  });
}

describe("POST /api/upload/image", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockEnv.CLOUDINARY_CLOUD_NAME = "test-cloud";
    mockEnv.CLOUDINARY_API_KEY = "test-cloud-key";
    mockEnv.CLOUDINARY_API_SECRET = "test-cloud-secret";
    mockEnv.ALLOW_BASE64_UPLOAD_FALLBACK = "0";
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 30,
      remaining: 29,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockOptionalAuth.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uploads via base64 fallback in non-production when cloudinary is not configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockEnv.CLOUDINARY_CLOUD_NAME = "";
    mockEnv.CLOUDINARY_API_KEY = "";
    mockEnv.CLOUDINARY_API_SECRET = "";

    const { POST } = await import("./route");
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(String(data.data.url)).toMatch(/^data:image\/png;base64,/);
    expect(mockRequireSameOrigin).toHaveBeenCalledOnce();
    expect(mockEnforceRateLimit).toHaveBeenCalledOnce();
  });

  it("returns 503 in production when cloudinary is not configured and fallback is disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockEnv.CLOUDINARY_CLOUD_NAME = "";
    mockEnv.CLOUDINARY_API_KEY = "";
    mockEnv.CLOUDINARY_API_SECRET = "";
    mockEnv.ALLOW_BASE64_UPLOAD_FALLBACK = "0";

    const { POST } = await import("./route");
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error.message).toContain("Image upload service is unavailable");
  });

  it("returns 400 for invalid folder path", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { POST } = await import("./route");
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const res = await POST(makeRequest(file, "../bad-folder"));

    expect(res.status).toBe(400);
  });
});
