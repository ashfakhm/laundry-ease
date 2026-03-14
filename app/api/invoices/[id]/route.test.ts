import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";

const { mockRequireProvider, mockGetDb } = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET, POST } from "./route";

const BOOKING_ID = "507f1f77bcf86cd799439091";
const PROVIDER_ID = "507f1f77bcf86cd799439092";
const SEEKER_ID = "507f1f77bcf86cd799439093";

function makeDbMock() {
  const invoicesUpdateOne = vi.fn();
  const bookingsFindOne = vi.fn();
  const bookingsUpdateOne = vi.fn();
  const db = {
    collection: vi.fn((name: string) => {
      if (name === "invoices") {
        return {
          updateOne: invoicesUpdateOne,
        };
      }
      if (name === "bookings") {
        return {
          findOne: bookingsFindOne,
          updateOne: bookingsUpdateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };
  return {
    db,
    invoicesUpdateOne,
    bookingsFindOne,
    bookingsUpdateOne,
  };
}

function makeRequest(body: unknown) {
  return new Request(`https://laundryease.test/api/invoices/${BOOKING_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(id: string) {
  return new Request(`https://laundryease.test/api/invoices/${id}`, {
    method: "GET",
  });
}

const VALID_BODY = {
  items: [{ itemType: "Shirt", quantity: 2, unitPrice: 120 }],
  notes: "Handle with care",
  total: 240,
};

describe("POST /api/invoices/[id]", () => {
  beforeEach(() => {
    mockGetDb.mockReset();
    mockRequireProvider.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps provider auth errors without converting them to 500", async () => {
    mockRequireProvider.mockRejectedValueOnce(
      new AppError(
        ErrorCode.FORBIDDEN,
        403,
        "This action requires PROVIDER role",
      ),
    );

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.message).toBe("This action requires PROVIDER role");
  });

  it("returns 400 for invalid booking id", async () => {
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toBe("Invalid booking ID");
  });

  it("returns 404 when booking does not exist", async () => {
    const dbMock = makeDbMock();
    dbMock.bookingsFindOne.mockResolvedValue(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.message).toBe("Booking not found");
  });

  it("returns 403 when provider does not own booking", async () => {
    const dbMock = makeDbMock();
    dbMock.bookingsFindOne.mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      provider_id: new ObjectId("507f1f77bcf86cd799439099"),
      status: "confirmed",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.message).toBe("Unauthorized");
  });

  it("persists invoice with provider ObjectId from authenticated session", async () => {
    const dbMock = makeDbMock();
    dbMock.bookingsFindOne.mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "confirmed",
    });
    dbMock.invoicesUpdateOne.mockResolvedValue({ acknowledged: true });
    dbMock.bookingsUpdateOne.mockResolvedValue({ acknowledged: true });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(dbMock.invoicesUpdateOne).toHaveBeenCalledOnce();
    expect(dbMock.bookingsUpdateOne).toHaveBeenCalledOnce();

    const [filter] = dbMock.invoicesUpdateOne.mock.calls[0];
    expect(filter.provider_id).toBeInstanceOf(ObjectId);
    expect(filter.booking_id).toBeInstanceOf(ObjectId);
    expect(String(filter.provider_id)).toBe(PROVIDER_ID);
    expect(String(filter.booking_id)).toBe(BOOKING_ID);
  });
});

describe("GET /api/invoices/[id]", () => {
  beforeEach(() => {
    mockGetDb.mockReset();
    mockRequireProvider.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns PDF when booking has embedded invoice", async () => {
    const bookingId = new ObjectId(BOOKING_ID);
    const providerId = new ObjectId(PROVIDER_ID);
    const seekerId = new ObjectId(SEEKER_ID);

    const bookingsFindOne = vi.fn().mockResolvedValue({
      _id: bookingId,
      provider_id: providerId,
      seeker_id: seekerId,
      status: "completed",
      invoice: {
        items: [{ itemType: "Shirt", quantity: 2, unitPrice: 120 }],
        subtotal: 240,
        discount: 0,
        total: 240,
        createdAt: new Date(),
      },
      createdAt: new Date(),
    });

    const ordersFindOne = vi.fn().mockResolvedValue(null);
    const invoicesFindOne = vi.fn().mockResolvedValue(null);
    const providersFindOne = vi.fn().mockResolvedValue({
      _id: providerId,
      name: "Smoke Provider",
      email: "provider@laundryease.test",
    });
    const seekersFindOne = vi.fn().mockResolvedValue({
      _id: seekerId,
      name: "Smoke Seeker",
      email: "seeker@laundryease.test",
    });

    const db = {
      collection: vi.fn((name: string) => {
        if (name === "bookings") return { findOne: bookingsFindOne };
        if (name === "orders") return { findOne: ordersFindOne };
        if (name === "invoices") return { findOne: invoicesFindOne };
        if (name === "providers") return { findOne: providersFindOne };
        if (name === "seekers") return { findOne: seekersFindOne };
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    mockGetDb.mockResolvedValue({ db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await GET(makeGetRequest(BOOKING_ID), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("returns PDF when only order exists (legacy string id)", async () => {
    const providerId = new ObjectId(PROVIDER_ID);
    const seekerId = new ObjectId(SEEKER_ID);
    const legacyOrderId = BOOKING_ID;

    const bookingsFindOne = vi.fn().mockResolvedValue(null);
    const ordersFindOne = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: legacyOrderId,
        booking_id: null,
        provider_id: providerId,
        seeker_id: seekerId,
        items: [
          { name: "Wash", quantity: 1, unit_price: 100, line_total: 100 },
        ],
        subtotal: 100,
        discount: 0,
        total_price: 100,
        delivery_charge: 0,
        createdAt: new Date(),
      });
    const invoicesFindOne = vi.fn().mockResolvedValue(null);
    const providersFindOne = vi.fn().mockResolvedValue({
      _id: providerId,
      name: "Smoke Provider",
    });
    const seekersFindOne = vi.fn().mockResolvedValue({
      _id: seekerId,
      name: "Smoke Seeker",
    });

    const db = {
      collection: vi.fn((name: string) => {
        if (name === "bookings") return { findOne: bookingsFindOne };
        if (name === "orders") return { findOne: ordersFindOne };
        if (name === "invoices") return { findOne: invoicesFindOne };
        if (name === "providers") return { findOne: providersFindOne };
        if (name === "seekers") return { findOne: seekersFindOne };
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    mockGetDb.mockResolvedValue({ db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await GET(makeGetRequest(legacyOrderId), {
      params: Promise.resolve({ id: legacyOrderId }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("falls back to order when booking exists without invoice", async () => {
    const bookingId = new ObjectId(BOOKING_ID);
    const providerId = new ObjectId(PROVIDER_ID);
    const seekerId = new ObjectId(SEEKER_ID);

    const bookingsFindOne = vi.fn().mockResolvedValue({
      _id: bookingId,
      provider_id: providerId,
      seeker_id: seekerId,
      status: "accepted",
      createdAt: new Date(),
    });

    const ordersFindOne = vi.fn().mockResolvedValueOnce({
      _id: new ObjectId(),
      booking_id: bookingId,
      provider_id: providerId,
      seeker_id: seekerId,
      items: [{ name: "Iron", quantity: 3, unit_price: 50, line_total: 150 }],
      subtotal: 150,
      discount: 0,
      total_price: 150,
      delivery_charge: 0,
      createdAt: new Date(),
    });

    const invoicesFindOne = vi.fn().mockResolvedValue(null);
    const providersFindOne = vi.fn().mockResolvedValue({
      _id: providerId,
      name: "Smoke Provider",
    });
    const seekersFindOne = vi.fn().mockResolvedValue({
      _id: seekerId,
      name: "Smoke Seeker",
    });

    const db = {
      collection: vi.fn((name: string) => {
        if (name === "bookings") return { findOne: bookingsFindOne };
        if (name === "orders") return { findOne: ordersFindOne };
        if (name === "invoices") return { findOne: invoicesFindOne };
        if (name === "providers") return { findOne: providersFindOne };
        if (name === "seekers") return { findOne: seekersFindOne };
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    mockGetDb.mockResolvedValue({ db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await GET(makeGetRequest(BOOKING_ID), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("returns 404 when booking/order is missing", async () => {
    const bookingsFindOne = vi.fn().mockResolvedValue(null);
    const ordersFindOne = vi.fn().mockResolvedValue(null);
    const db = {
      collection: vi.fn((name: string) => {
        if (name === "bookings") return { findOne: bookingsFindOne };
        if (name === "orders") return { findOne: ordersFindOne };
        if (name === "invoices") return { findOne: vi.fn() };
        if (name === "providers") return { findOne: vi.fn() };
        if (name === "seekers") return { findOne: vi.fn() };
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    mockGetDb.mockResolvedValue({ db });
    mockRequireProvider.mockResolvedValue({
      user: { id: PROVIDER_ID, email: "provider@laundryease.test" },
    });

    const res = await GET(makeGetRequest(BOOKING_ID), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.message).toBe("Booking not found");
  });
});
