import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { createHash } from "crypto";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockGetDb,
  mockBcryptHash,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockBcryptHash: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mockBcryptHash,
  },
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

function makeDbMock() {
  const tokenFindOne = vi.fn();
  const tokenUpdateOne = vi.fn();
  const tokenUpdateMany = vi.fn();
  const seekerUpdateOne = vi.fn();
  const providerUpdateOne = vi.fn();
  const adminUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "password_reset_tokens") {
        return {
          findOne: tokenFindOne,
          updateOne: tokenUpdateOne,
          updateMany: tokenUpdateMany,
        };
      }
      if (name === "seekers") {
        return { updateOne: seekerUpdateOne };
      }
      if (name === "providers") {
        return { updateOne: providerUpdateOne };
      }
      if (name === "admins") {
        return { updateOne: adminUpdateOne };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    tokenFindOne,
    tokenUpdateOne,
    tokenUpdateMany,
    seekerUpdateOne,
    providerUpdateOne,
    adminUpdateOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 15,
      remaining: 14,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockBcryptHash.mockResolvedValue("hashed_password");
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(makeRequest({ token: "", password: "" }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Token and password are required");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockEnforceRateLimit.mockRejectedValueOnce(
      new AppError(
        ErrorCode.RATE_LIMITED,
        429,
        "Too many requests. Please try again shortly.",
      ),
    );

    const res = await POST(
      makeRequest({
        token: "reset-token",
        password: "StrongPass1!",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("returns 400 when reset token is invalid or expired", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.tokenFindOne.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        token: "missing-token",
        password: "StrongPass1!",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid or expired");
  });

  it("resets password and invalidates all active reset tokens", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    const token = "valid-token";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const userId = new ObjectId();
    dbMock.tokenFindOne.mockResolvedValue({
      _id: new ObjectId(),
      tokenHash,
      userId,
      role: Role.SEEKER,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });
    dbMock.seekerUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.tokenUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.tokenUpdateMany.mockResolvedValue({ modifiedCount: 2 });

    const res = await POST(
      makeRequest({
        token,
        password: "StrongPass1!",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("successful");
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ bucket: "auth:reset-password:ip" }),
    );
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ bucket: "auth:reset-password:token" }),
    );
    expect(dbMock.seekerUpdateOne).toHaveBeenCalledOnce();
    expect(dbMock.tokenUpdateOne).toHaveBeenCalledOnce();
    expect(dbMock.tokenUpdateMany).toHaveBeenCalledOnce();
  });
});
