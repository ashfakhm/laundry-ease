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
  const invoicesInsertOne = vi.fn();
  const db = {
    collection: vi.fn((name: string) => {
      if (name === "invoices") {
        return {
          insertOne: invoicesInsertOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };
  return {
    db,
    invoicesInsertOne,
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

  it("persists invoice with provider ObjectId from authenticated session", async () => {
    const dbMock = makeDbMock();
    dbMock.invoicesInsertOne.mockResolvedValue({ acknowledged: true });
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
    expect(dbMock.invoicesInsertOne).toHaveBeenCalledOnce();

    const inserted = dbMock.invoicesInsertOne.mock.calls[0][0];
    expect(inserted.provider_id).toBeInstanceOf(ObjectId);
    expect(inserted.booking_id).toBeInstanceOf(ObjectId);
    expect(String(inserted.provider_id)).toBe(PROVIDER_ID);
    expect(String(inserted.booking_id)).toBe(BOOKING_ID);
  });
});
