import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "@/lib/api/errors";

const { mockEnforceRateLimit, mockLoggerWarn, mockLoggerError } = vi.hoisted(
  () => ({
    mockEnforceRateLimit: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
  }),
);

vi.mock("@/lib/api/security", () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/security/csp-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/csp-report",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/security/csp-report", () => {
  beforeEach(() => {
    mockEnforceRateLimit.mockResolvedValue({
      limit: 120,
      remaining: 119,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a report payload and logs a sanitized warning", async () => {
    const longValue = "x".repeat(1200);
    const res = await POST(
      makeRequest({
        "csp-report": {
          "document-uri": "https://laundryease.test/seeker",
          "blocked-uri": "inline",
          sample: longValue,
        },
      }),
    );

    expect(res.status).toBe(204);
    expect(mockEnforceRateLimit).toHaveBeenCalledOnce();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "SECURITY",
      "Received CSP violation report",
      expect.objectContaining({
        report: expect.objectContaining({
          sample: expect.any(String),
        }),
      }),
    );
  });

  it("returns app error status when rate limiter blocks requests", async () => {
    mockEnforceRateLimit.mockRejectedValue(
      new AppError(ErrorCode.RATE_LIMITED, 429, "Too many requests"),
    );

    const res = await POST(makeRequest({ foo: "bar" }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Too many requests");
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

