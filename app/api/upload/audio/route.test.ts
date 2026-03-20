import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "507f1f77bcf86cd799439011";

const {
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockEnv,
  mockCloudinaryConfig,
  mockCloudinaryUploadStream,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockEnv: {
    CLOUDINARY_CLOUD_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    ALLOW_BASE64_UPLOAD_FALLBACK: "0",
  } as Record<string, string>,
  mockCloudinaryConfig: vi.fn(),
  mockCloudinaryUploadStream: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

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

vi.mock("cloudinary", () => ({
  default: {
    v2: {
      config: mockCloudinaryConfig,
      uploader: {
        upload_stream: mockCloudinaryUploadStream,
      },
    },
  },
}));

function createMockFile(type: string, name: string): File {
  const file = new File([new Uint8Array([1, 2, 3])], name, {
    type: type.split(";")[0] || type,
  });
  Object.defineProperty(file, "type", {
    value: type,
    configurable: true,
  });
  return file;
}

function makeRequest(file: File, folder?: string) {
  const formData = new FormData();
  formData.set("file", file);
  if (folder) {
    formData.set("folder", folder);
  }

  return new NextRequest("https://laundryease.test/api/upload/audio", {
    method: "POST",
    headers: {
      origin: "https://laundryease.test",
    },
    body: formData,
  });
}

describe("POST /api/upload/audio", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    mockEnv.CLOUDINARY_CLOUD_NAME = "";
    mockEnv.CLOUDINARY_API_KEY = "";
    mockEnv.CLOUDINARY_API_SECRET = "";
    mockEnv.ALLOW_BASE64_UPLOAD_FALLBACK = "0";
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAuth.mockResolvedValue({
      user: {
        id: USER_ID,
        email: "voice@laundryease.test",
        role: "seeker",
      },
    });
    mockCloudinaryConfig.mockReset();
    mockCloudinaryUploadStream.mockReset();
    mockCloudinaryUploadStream.mockReturnValue({ end: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("accepts audio/webm with codec parameters", async () => {
    const { POST } = await import("./route");
    const file = createMockFile("audio/webm;codecs=opus", "voice.webm");

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(String(data.data.url)).toMatch(
      /^data:audio\/webm;codecs=opus;base64,/,
    );
    expect(mockRequireSameOrigin).toHaveBeenCalledOnce();
    expect(mockEnforceRateLimit).toHaveBeenCalledOnce();
    expect(mockRequireAuth).toHaveBeenCalledOnce();
  });

  it("accepts audio/mp4 with codec parameters", async () => {
    const { POST } = await import("./route");
    const file = createMockFile("audio/mp4;codecs=mp4a.40.2", "voice.mp4");

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(String(data.data.url)).toMatch(
      /^data:audio\/mp4;codecs=mp4a\.40\.2;base64,/,
    );
  });

  it("accepts the common audio/x-wav alias", async () => {
    const { POST } = await import("./route");
    const file = createMockFile("audio/x-wav", "voice.wav");

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(String(data.data.url)).toMatch(/^data:audio\/x-wav;base64,/);
  });

  it("rejects unsupported non-audio types", async () => {
    const { POST } = await import("./route");
    const file = createMockFile("video/webm", "voice.webm");

    const res = await POST(makeRequest(file));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Invalid file type");
  });
});
