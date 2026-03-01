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
  const seekerFindOne = vi.fn();
  const providerFindOne = vi.fn();
  const complaintMessagesInsertOne = vi.fn();
  const notificationsInsertMany = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return {
          findOne: complaintFindOne,
          updateOne: complaintUpdateOne,
        };
      }
      if (name === "seekers") {
        return {
          findOne: seekerFindOne,
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
      if (name === "notifications") {
        return {
          insertMany: notificationsInsertMany,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    complaintFindOne,
    complaintUpdateOne,
    seekerFindOne,
    providerFindOne,
    complaintMessagesInsertOne,
    notificationsInsertMany,
  };
}

function makeRequest(body: unknown = { deadlineDays: 7 }) {
  return new Request("https://laundryease.test/api/admin/complaints/123/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/complaints/[id]/accept", () => {
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

  it("accepts complaint and creates seeker/provider notifications", async () => {
    const complaintId = new ObjectId();
    const seekerId = new ObjectId();
    const providerId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    dbMock.complaintFindOne.mockResolvedValue({
      _id: complaintId,
      status: "open",
      seeker_id: seekerId,
      provider_id: providerId,
    });
    dbMock.complaintUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.seekerFindOne.mockResolvedValue({
      _id: seekerId,
      name: "John Seeker",
      email: "john@laundryease.test",
    });
    dbMock.providerFindOne.mockResolvedValue({
      _id: providerId,
      name: "Clean Pro",
      businessName: "Clean Pro Laundry",
      email: "provider@laundryease.test",
    });
    dbMock.complaintMessagesInsertOne.mockResolvedValue({ acknowledged: true });
    dbMock.notificationsInsertMany.mockResolvedValue({ acknowledged: true });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("accepted");
    expect(dbMock.complaintUpdateOne).toHaveBeenCalledOnce();
    expect(dbMock.complaintMessagesInsertOne).toHaveBeenCalledOnce();
    expect(dbMock.notificationsInsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_id: seekerId,
          recipient_role: "seeker",
          category: "complaint_accepted",
        }),
        expect.objectContaining({
          recipient_id: providerId,
          recipient_role: "provider",
          category: "complaint_accepted",
        }),
      ]),
    );
  });
});
