import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";

const { mockRequireAdmin, mockGetDb } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
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
  const ordersFindOne = vi.fn();
  const ordersUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          findOne: ordersFindOne,
          updateOne: ordersUpdateOne,
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, ordersFindOne, ordersUpdateOne };
}

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("https://laundryease.test/api/admin/orders/123/extend-complaint"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/admin/orders/[id]/extend-complaint", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({
      user: { id: new ObjectId().toString(), role: "admin" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid order id", async () => {
    const res = await POST(makeRequest({ extensionDateAt: "2026-04-01T00:00:00Z" }), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid order ID");
  });

  it("returns 400 for invalid extension date", async () => {
    const orderId = new ObjectId();
    const res = await POST(makeRequest({ extensionDateAt: "not-a-date" }), {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid extension date");
  });

  it("returns 404 when order not found or not delivered", async () => {
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.ordersFindOne.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ extensionDateAt: "2026-04-01T00:00:00Z" }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("not found or not delivered");
  });

  it("extends complaint window successfully", async () => {
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      process_status: "delivered",
    });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });

    const extensionDate = "2026-04-01T00:00:00Z";
    const res = await POST(makeRequest({ extensionDateAt: extensionDate }), {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain("extended successfully");
    expect(dbMock.ordersUpdateOne).toHaveBeenCalledWith(
      { _id: orderId },
      {
        $set: expect.objectContaining({
          extended_complaint_window_until: new Date(extensionDate),
        }),
      },
    );
  });

  it("returns 500 when update modifies nothing", async () => {
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.ordersFindOne.mockResolvedValue({
      _id: orderId,
      process_status: "delivered",
    });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 0 });

    const res = await POST(
      makeRequest({ extensionDateAt: "2026-04-01T00:00:00Z" }),
      { params: Promise.resolve({ id: orderId.toString() }) },
    );
    expect(res.status).toBe(500);
  });
});
