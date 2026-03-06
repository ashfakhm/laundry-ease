import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireAdminWithDbCheck,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
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
  },
}));

import { PATCH } from "./route";

function makeDbMock() {
  const findOne = vi.fn();
  const updateOne = vi.fn();
  const db = {
    collection: vi.fn(() => ({
      findOne,
      updateOne,
    })),
  };
  return { db, findOne, updateOne };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/admin/complaints/123", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/complaints/[id]", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 40,
      remaining: 39,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        email: "admin@laundryease.test",
        role: "admin",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid complaint id", async () => {
    const res = await PATCH(makeRequest({ status: "accepted" }) as never, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    expect(res.status).toBe(400);
    expect(mockRequireAdminWithDbCheck).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status payload", async () => {
    const res = await PATCH(makeRequest({ status: "unknown_status" }) as never, {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when complaint does not exist", async () => {
    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await PATCH(makeRequest({ status: "accepted" }) as never, {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    expect(res.status).toBe(404);
    expect(dbMock.findOne).toHaveBeenCalledTimes(1);
    expect(dbMock.updateOne).not.toHaveBeenCalled();
  });

  it("returns success and updates complaint status", async () => {
    const complaintId = new ObjectId();
    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue({
      _id: complaintId,
      provider_access_granted: true,
    });
    dbMock.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await PATCH(makeRequest({ status: "in_review" }) as never, {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toEqual({ ok: true });
    expect(dbMock.findOne).toHaveBeenCalledWith(
      { _id: complaintId },
      { projection: { provider_access_granted: 1 } },
    );
    expect(dbMock.updateOne).toHaveBeenCalledWith(
      { _id: complaintId },
      { $set: { status: "in_review" } },
    );
  });

  it("maps AppError to expected status and payload", async () => {
    mockRequireAdminWithDbCheck.mockRejectedValue(
      new AppError(ErrorCode.FORBIDDEN, 403, "Admin access required"),
    );

    const res = await PATCH(makeRequest({ status: "accepted" }) as never, {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.message).toBe("Admin access required");
  });
});
