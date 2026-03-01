import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockGetDb,
  mockEnqueueEmailOutboxJob,
  mockSignJWT,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockEnqueueEmailOutboxJob: vi.fn(),
  mockSignJWT: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/email-outbox", () => ({
  enqueueEmailOutboxJob: mockEnqueueEmailOutboxJob,
}));

vi.mock("jose", () => {
  const signInstance = {
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: mockSignJWT,
  };
  return {
    SignJWT: vi.fn(() => signInstance),
  };
});

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "https://laundryease.test",
    NEXT_PUBLIC_BASE_URL: "https://laundryease.test",
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
  const seekersFindOne = vi.fn();
  const providersFindOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "seekers") {
        return {
          findOne: seekersFindOne,
        };
      }
      if (name === "providers") {
        return {
          findOne: providersFindOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    seekersFindOne,
    providersFindOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/auth/send-magic-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/send-magic-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 10,
      remaining: 9,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockSignJWT.mockResolvedValue("signed-token");
    mockEnqueueEmailOutboxJob.mockResolvedValue({
      id: "job_1",
      queuedAt: new Date().toISOString(),
    });
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      makeRequest({
        email: "invalid-email",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Valid email");
  });

  it("returns 404 when user does not exist", async () => {
    const dbMock = makeDbMock();
    dbMock.seekersFindOne.mockResolvedValue(null);
    dbMock.providersFindOne.mockResolvedValue(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        email: "missing@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.message).toContain("User not found");
    expect(mockEnqueueEmailOutboxJob).not.toHaveBeenCalled();
  });

  it("queues a magic link email for existing seeker", async () => {
    const dbMock = makeDbMock();
    dbMock.seekersFindOne.mockResolvedValue({ _id: "seeker-1" });
    dbMock.providersFindOne.mockResolvedValue(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        email: "seeker@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSignJWT).toHaveBeenCalledOnce();
    expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledWith({
      kind: "magic_link",
      payload: {
        to: "seeker@laundryease.test",
        verificationLink:
          "https://laundryease.test/verify-email?token=signed-token",
      },
    });
  });

  it("returns AppError response when rate limited", async () => {
    mockEnforceRateLimit.mockRejectedValueOnce(
      new AppError(ErrorCode.RATE_LIMITED, 429, "Too many requests"),
    );

    const res = await POST(
      makeRequest({
        email: "seeker@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error.message).toContain("Too many requests");
  });
});
