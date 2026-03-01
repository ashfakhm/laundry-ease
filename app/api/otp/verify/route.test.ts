import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "@/lib/api/errors";

const { mockVerifyOtp, mockRequireSameOrigin, mockEnforceRateLimit } =
  vi.hoisted(() => ({
    mockVerifyOtp: vi.fn(),
    mockRequireSameOrigin: vi.fn(),
    mockEnforceRateLimit: vi.fn(),
  }));

vi.mock("@/lib/otp", () => ({
  verifyOtp: mockVerifyOtp,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/otp/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockVerifyOtp.mockResolvedValue({ ok: true });
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email", code: "1" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Invalid params");
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it("returns AppError status when rate limited", async () => {
    mockEnforceRateLimit.mockRejectedValueOnce(
      new AppError(ErrorCode.RATE_LIMITED, 429, "Too many requests"),
    );

    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email", code: "123456" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error.message).toContain("Too many requests");
  });

  it("returns 400 when OTP verification fails", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: false, error: "Invalid code" });

    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email", code: "123456" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Invalid code");
  });

  it("returns 200 for successful OTP verification", async () => {
    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email", code: "123456" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockVerifyOtp).toHaveBeenCalledWith("user@example.com", "email", "123456");
  });
});
