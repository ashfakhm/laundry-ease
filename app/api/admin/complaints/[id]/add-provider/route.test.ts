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

import { POST } from "./route";

function makeDbMock() {
  const complaintFindOne = vi.fn();
  const complaintUpdateOne = vi.fn();
  const providerFindOne = vi.fn();
  const complaintMessagesInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return {
          findOne: complaintFindOne,
          updateOne: complaintUpdateOne,
        };
      }
      if (name === "providers") {
        return {
          findOne: providerFindOne,
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
    providerFindOne,
    complaintMessagesInsertOne,
  };
}

function makeRequest() {
  return new Request(
    "https://laundryease.test/api/admin/complaints/123/add-provider",
    {
      method: "POST",
      headers: {
        origin: "https://laundryease.test",
      },
    },
  );
}

describe("POST /api/admin/complaints/[id]/add-provider", () => {
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
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when complaint is not accepted/in_review", async () => {
    const complaintId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: providerId,
      status: "open",
      provider_access_granted: false,
    });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    expect(res.status).toBe(409);
    expect(dbMock.complaintUpdateOne).not.toHaveBeenCalled();
  });

  it("returns idempotent success when provider already has access", async () => {
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

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.data.idempotent).toBe(true);
    expect(data.data.message).toBe("Provider already added");
    expect(dbMock.complaintUpdateOne).not.toHaveBeenCalled();
    expect(dbMock.complaintMessagesInsertOne).not.toHaveBeenCalled();
  });

  it("adds provider to accepted complaint and writes system message", async () => {
    const complaintId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: providerId,
      status: "accepted",
      provider_access_granted: false,
    });
    dbMock.complaintUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.providerFindOne.mockResolvedValue({
      _id: providerId,
      businessName: "Ash Laundry Services",
    });
    dbMock.complaintMessagesInsertOne.mockResolvedValue({ acknowledged: true });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ok).toBe(true);
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
        content:
          "Ash Laundry Services has been added to this conversation by Admin",
      }),
    );
  });

  it("returns 409 when complaint provider reference is invalid", async () => {
    const complaintId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      provider_id: "bad-provider-id",
      status: "accepted",
      provider_access_granted: false,
    });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    expect(res.status).toBe(409);
    expect(dbMock.complaintUpdateOne).not.toHaveBeenCalled();
  });
});
