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

import { POST } from "./route";

const BOOKING_ID = "507f1f77bcf86cd799439091";
const PROVIDER_ID = "507f1f77bcf86cd799439092";

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
    expect(data.error).toBe("This action requires PROVIDER role");
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
    expect(data.error).toBe("Invalid booking ID");
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
    expect(data.error).toBe("Booking not found");
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
    expect(data.error).toBe("Unauthorized");
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
