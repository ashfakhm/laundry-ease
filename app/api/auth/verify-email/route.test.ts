import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDb, mockJwtVerify, mockRequireSameOrigin, mockEnforceRateLimit } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockJwtVerify: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
}));

vi.mock("@/lib/env", () => ({
  env: { NEXTAUTH_SECRET: "test-jwt-secret" },
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("https://laundryease.test/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/verify-email", () => {
  const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockJwtVerify.mockResolvedValue({
      payload: {
        email: "user@example.com",
        type: "email_verification",
      },
    });
    const mockFindOne = vi
      .fn()
      .mockResolvedValue({ _id: "user1", email: "user@example.com" });
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          findOne: mockFindOne,
          updateOne: mockUpdateOne,
        }),
      },
    });
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is invalid", async () => {
    mockJwtVerify.mockRejectedValue(new Error("invalid"));
    const res = await POST(makeReq({ token: "bad-token" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token type is wrong", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        email: "user@example.com",
        type: "password_reset",
      },
    });
    const res = await POST(makeReq({ token: "valid-token" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          findOne: vi.fn().mockResolvedValue(null),
          updateOne: mockUpdateOne,
        }),
      },
    });
    mockJwtVerify.mockResolvedValue({
      payload: {
        email: "user@example.com",
        type: "email_verification",
      },
    });
    const res = await POST(makeReq({ token: "valid-token" }));
    expect(res.status).toBe(404);
  });

  it("verifies email successfully", async () => {
    const res = await POST(makeReq({ token: "valid-token" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("applies request origin and rate-limit guards", async () => {
    await POST(makeReq({ token: "valid-token" }));
    expect(mockRequireSameOrigin).toHaveBeenCalledTimes(1);
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1);
  });
});
