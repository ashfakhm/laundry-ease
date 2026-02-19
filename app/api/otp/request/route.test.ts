import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "@/lib/api/errors";

const { mockRequestOtp, mockRequireSameOrigin, mockEnforceRateLimit } =
  vi.hoisted(() => ({
    mockRequestOtp: vi.fn(),
    mockRequireSameOrigin: vi.fn(),
    mockEnforceRateLimit: vi.fn(),
  }));

vi.mock("@/lib/otp", () => ({
  requestOtp: mockRequestOtp,
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
  return new Request("https://laundryease.test/api/otp/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/otp/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequestOtp.mockResolvedValue({ ok: true });
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(
      makeRequest({ target: "x", type: "email" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid params");
    expect(mockRequestOtp).not.toHaveBeenCalled();
  });

  it("returns AppError status when rate limited", async () => {
    mockEnforceRateLimit.mockRejectedValueOnce(
      new AppError(ErrorCode.RATE_LIMITED, 429, "Too many requests"),
    );

    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("returns 429 when otp layer reports rate limit", async () => {
    mockRequestOtp.mockResolvedValue({
      ok: false,
      error: "Too many OTP requests. Please try again later.",
    });

    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.ok).toBe(false);
  });

  it("returns 502 for non-rate-limit OTP dispatch failures", async () => {
    mockRequestOtp.mockResolvedValue({
      ok: false,
      error: "Failed to send OTP",
    });

    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.ok).toBe(false);
  });

  it("returns 200 for successful OTP requests", async () => {
    const res = await POST(
      makeRequest({ target: "user@example.com", type: "email" }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockRequestOtp).toHaveBeenCalledWith("user@example.com", "email");
  });
});
