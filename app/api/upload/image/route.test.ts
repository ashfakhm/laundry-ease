import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";

const {
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
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
  return new Request("https://laundryease.test/api/upload/image", {
    method: "POST",
    headers: {
      origin: "https://laundryease.test",
    },
    body: formData,
  }) as unknown as NextRequest;
}

describe("POST /api/upload/image", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 30,
      remaining: 29,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAuth.mockResolvedValue({
      user: { id: new ObjectId().toString(), email: "user@laundryease.test" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uploads via base64 fallback in non-production when cloudinary is not configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    vi.stubEnv("CLOUDINARY_API_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");

    const { POST } = await import("./route");
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(String(data.url)).toMatch(/^data:image\/png;base64,/);
    expect(mockRequireSameOrigin).toHaveBeenCalledOnce();
    expect(mockEnforceRateLimit).toHaveBeenCalledOnce();
  });

  it("returns 503 in production when cloudinary is not configured and fallback is disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    vi.stubEnv("CLOUDINARY_API_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    vi.stubEnv("ALLOW_BASE64_UPLOAD_FALLBACK", "0");

    const { POST } = await import("./route");
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toContain("Image upload service is unavailable");
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
