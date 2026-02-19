import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireAuth,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
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
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST } from "./route";

const ORDER_ID = new ObjectId().toString();
const PROVIDER_ID = new ObjectId().toString();
const SEEKER_ID = new ObjectId().toString();

function makeDbMock() {
  const findOne = vi.fn();
  const updateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          findOne,
          updateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, findOne, updateOne };
}

function makeRequest(orderId: string, body: unknown) {
  return new Request(
    `https://laundryease.test/api/orders/${orderId}/schedule-delivery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://laundryease.test",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/orders/[id]/schedule-delivery", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 30,
      remaining: 29,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockGetDb.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid order id", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });

    const res = await POST(
      makeRequest("bad-id", {
        action: "confirm",
      }),
      {
        params: Promise.resolve({ id: "bad-id" }),
      },
    );

    expect(res.status).toBe(400);
  });

  it("returns 403 when non-provider attempts propose", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      process_status: "ready",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest(ORDER_ID, {
        action: "propose",
        dateTime: new Date(Date.now() + 60_000).toISOString(),
      }),
      {
        params: Promise.resolve({ id: ORDER_ID }),
      },
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 when non-seeker attempts confirm", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: PROVIDER_ID,
        role: Role.PROVIDER,
        email: "provider@test.com",
      },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      process_status: "ready",
      deliverySlot: {
        proposedBy: "provider",
        dateTime: new Date(),
      },
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest(ORDER_ID, {
        action: "confirm",
      }),
      {
        params: Promise.resolve({ id: ORDER_ID }),
      },
    );

    expect(res.status).toBe(403);
  });

  it("returns 200 for valid provider propose on owned order", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: PROVIDER_ID,
        role: Role.PROVIDER,
        email: "provider@test.com",
      },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      process_status: "ready",
    });
    dbMock.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const dateTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const res = await POST(
      makeRequest(ORDER_ID, {
        action: "propose",
        dateTime,
      }),
      {
        params: Promise.resolve({ id: ORDER_ID }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(dbMock.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      expect.objectContaining({
        $set: expect.objectContaining({
          process_status: "ready",
        }),
      }),
    );
  });
});
