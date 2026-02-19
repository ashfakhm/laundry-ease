import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

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
  const complaintFindOne = vi.fn();
  const complaintUpdateOne = vi.fn();
  const complaintMessagesInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return {
          findOne: complaintFindOne,
          updateOne: complaintUpdateOne,
        };
      }
      if (name === "complaint_messages") {
        return {
          insertOne: complaintMessagesInsertOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    complaintFindOne,
    complaintUpdateOne,
    complaintMessagesInsertOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/admin/complaints/123/access", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/complaints/[id]/access", () => {
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
    const res = await PATCH(makeRequest({ granted: true }), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when granting from non-accepted status", async () => {
    const complaintId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: providerId,
      status: "open",
    });

    const res = await PATCH(makeRequest({ granted: true }), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    expect(res.status).toBe(409);
    expect(dbMock.complaintUpdateOne).not.toHaveBeenCalled();
  });

  it("grants provider access from accepted complaint and sets in_review", async () => {
    const complaintId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: providerId,
      status: "accepted",
    });
    dbMock.complaintUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.complaintMessagesInsertOne.mockResolvedValue({ acknowledged: true });

    const res = await PATCH(makeRequest({ granted: true }), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, granted: true });
    expect(dbMock.complaintUpdateOne).toHaveBeenCalledWith(
      { _id: complaintId },
      {
        $set: {
          provider_access_granted: true,
          status: "in_review",
        },
        $addToSet: {
          participants: providerId,
        },
      },
    );
    expect(dbMock.complaintMessagesInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        complaint_id: complaintId,
        sender_role: "system",
        content: "Admin added Provider to the chat.",
      }),
    );
  });

  it("revokes access and moves in_review complaint back to accepted", async () => {
    const complaintId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: providerId,
      status: "in_review",
      provider_access_granted: true,
    });
    dbMock.complaintUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.complaintMessagesInsertOne.mockResolvedValue({ acknowledged: true });

    const res = await PATCH(makeRequest({ granted: false }), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, granted: false });
    expect(dbMock.complaintUpdateOne).toHaveBeenCalledWith(
      { _id: complaintId },
      {
        $set: {
          provider_access_granted: false,
          status: "accepted",
        },
      },
    );
    expect(dbMock.complaintMessagesInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Admin revoked Provider access.",
      }),
    );
  });

  it("returns 409 for finalized complaints", async () => {
    const complaintId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: providerId,
      status: "resolved",
    });

    const res = await PATCH(makeRequest({ granted: false }), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    expect(res.status).toBe(409);
    expect(dbMock.complaintUpdateOne).not.toHaveBeenCalled();
  });
});
