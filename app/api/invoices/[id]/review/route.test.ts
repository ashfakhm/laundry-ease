import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireSeeker,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
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
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown = { approved: true }) {
  return new Request("https://laundryease.test/api/invoices/123/review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

function makeDbMock() {
  const bookingsFindOne = vi.fn();
  const bookingsUpdateOne = vi.fn();
  const ordersFindOne = vi.fn();
  const ordersInsertOne = vi.fn();
  const ordersDeleteOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return {
          findOne: bookingsFindOne,
          updateOne: bookingsUpdateOne,
        };
      }
      if (name === "orders") {
        return {
          findOne: ordersFindOne,
          insertOne: ordersInsertOne,
          deleteOne: ordersDeleteOne,
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  const withTransaction = vi.fn(async (handler: () => Promise<void>) => {
    await handler();
  });
  const endSession = vi.fn(async () => undefined);
  const startSession = vi.fn(() => ({
    withTransaction,
    endSession,
  }));
  const client = { startSession };

  return {
    db,
    client,
    bookingsFindOne,
    bookingsUpdateOne,
    ordersFindOne,
    ordersInsertOne,
    ordersDeleteOne,
    withTransaction,
    endSession,
  };
}

describe("POST /api/invoices/[id]/review", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 15,
      remaining: 14,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: Role.SEEKER,
        email: "seeker@laundryease.test",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid booking id", async () => {
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "bad-id" }),
    });

    expect(res.status).toBe(400);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns idempotent success when booking already converted with existing order", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();
    const existingOrderId = new ObjectId();
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: seekerId.toString(),
        role: Role.SEEKER,
        email: "seeker@laundryease.test",
      },
    });

    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: dbMock.client });

    dbMock.bookingsFindOne.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      status: "completed",
    });
    dbMock.ordersFindOne.mockResolvedValue({
      _id: existingOrderId,
      booking_id: bookingId,
    });

    const res = await POST(makeRequest({ approved: true }), {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      orderId: existingOrderId.toString(),
    });
    expect(dbMock.ordersInsertOne).not.toHaveBeenCalled();
  });

  it("falls back to compensating finalize path when transactions are unavailable", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();
    const orderId = new ObjectId();
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: seekerId.toString(),
        role: Role.SEEKER,
        email: "seeker@laundryease.test",
      },
    });

    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: dbMock.client });

    dbMock.bookingsFindOne.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: new ObjectId(),
      status: "invoice_created",
      invoice: {
        items: [{ itemType: "Wash", quantity: 2, unitPrice: 50 }],
        notes: "Handle carefully",
      },
    });
    dbMock.withTransaction.mockRejectedValue(
      new Error("Transaction numbers are only allowed on a replica set member or mongos"),
    );
    dbMock.ordersInsertOne.mockResolvedValue({ insertedId: orderId });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await POST(makeRequest({ approved: true }), {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      orderId: orderId.toString(),
      status: "approved",
    });
    expect(dbMock.ordersInsertOne).toHaveBeenCalledOnce();
  });

  it("rolls back inserted order and returns 409 when booking link update conflicts", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();
    const orderId = new ObjectId();
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: seekerId.toString(),
        role: Role.SEEKER,
        email: "seeker@laundryease.test",
      },
    });

    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: dbMock.client });

    dbMock.bookingsFindOne
      .mockResolvedValueOnce({
        _id: bookingId,
        seeker_id: seekerId,
        provider_id: new ObjectId(),
        status: "invoice_created",
        invoice: {
          items: [{ itemType: "Iron", quantity: 1, unitPrice: 80 }],
        },
      })
      .mockResolvedValueOnce({
        _id: bookingId,
        seeker_id: seekerId,
        status: "cancelled",
      });

    dbMock.withTransaction.mockRejectedValue(
      new Error("Transactions are not supported by this deployment"),
    );
    dbMock.ordersInsertOne.mockResolvedValue({ insertedId: orderId });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });

    const res = await POST(makeRequest({ approved: true }), {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe(
      "Booking state changed while finalizing order. Please retry.",
    );
    expect(dbMock.ordersDeleteOne).toHaveBeenCalledWith({
      _id: orderId,
      booking_id: bookingId,
    });
  });
});
