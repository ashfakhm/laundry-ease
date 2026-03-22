import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockGetDb,
  mockGetUserByEmail,
  mockEnqueueEmailOutboxJob,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetUserByEmail: vi.fn(),
  mockEnqueueEmailOutboxJob: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db/index", () => ({
  getUserByEmail: mockGetUserByEmail,
}));

vi.mock("@/lib/env", () => ({
  env: {
    EMAIL_USER: "noreply@laundryease.test",
    EMAIL_PASS: "test-pass",
    AUTH_URL: "https://laundryease.test",
    NEXT_PUBLIC_BASE_URL: "https://laundryease.test",
    NEXTAUTH_URL: "https://laundryease.test",
  },
}));

vi.mock("@/lib/email-outbox", () => ({
  enqueueEmailOutboxJob: mockEnqueueEmailOutboxJob,
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
  const tokensInsertOne = vi.fn();
  const db = {
    collection: vi.fn((name: string) => {
      if (name === "password_reset_tokens") {
        return {
          insertOne: tokensInsertOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    tokensInsertOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 10,
      remaining: 9,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockEnqueueEmailOutboxJob.mockResolvedValue({
      id: "job_1",
      queuedAt: new Date().toISOString(),
    });
  });

  it("returns generic response for unknown account", async () => {
    mockGetUserByEmail.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        email: "missing@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.message).toContain("If an account exists");
    expect(mockEnqueueEmailOutboxJob).not.toHaveBeenCalled();
  });

  it("returns 429 when abuse limit is hit", async () => {
    mockEnforceRateLimit.mockRejectedValueOnce(
      new AppError(
        ErrorCode.RATE_LIMITED,
        429,
        "Too many requests. Please try again shortly.",
      ),
    );

    const res = await POST(
      makeRequest({
        email: "user@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error.message).toContain("Too many requests");
  });

  it("stores token and sends email for valid local account", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockGetUserByEmail.mockResolvedValue({
      _id: new ObjectId(),
      email: "user@laundryease.test",
      role: "seeker",
      passwordHash: "hash",
    });
    dbMock.tokensInsertOne.mockResolvedValue({ acknowledged: true });

    const res = await POST(
      makeRequest({
        email: "user@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.message).toContain("If an account exists");
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(2);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        bucket: "auth:forgot-password:ip",
      }),
    );
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        bucket: "auth:forgot-password:email",
      }),
    );
    expect(dbMock.tokensInsertOne).toHaveBeenCalledOnce();
    expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledOnce();
    expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledWith({
      kind: "password_reset",
      payload: expect.objectContaining({
        to: "user@laundryease.test",
      }),
    });
  });

  it("stores token and sends email for account without passwordHash", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockGetUserByEmail.mockResolvedValue({
      _id: new ObjectId(),
      email: "user@laundryease.test",
      role: "seeker",
      // passwordHash is missing
    });
    dbMock.tokensInsertOne.mockResolvedValue({ acknowledged: true });

    const res = await POST(
      makeRequest({
        email: "user@laundryease.test",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.message).toContain("If an account exists");
    expect(dbMock.tokensInsertOne).toHaveBeenCalledOnce();
    expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledOnce();
    expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledWith({
      kind: "password_reset",
      payload: expect.objectContaining({
        to: "user@laundryease.test",
      }),
    });
  });
});

