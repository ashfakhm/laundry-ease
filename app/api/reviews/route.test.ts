import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockRequireSeeker, mockGetDb } = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
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

const SEEKER_ID = "507f1f77bcf86cd799439081";
const PROVIDER_ID = "507f1f77bcf86cd799439082";
const OTHER_PROVIDER_ID = "507f1f77bcf86cd799439083";
const ORDER_ID = "507f1f77bcf86cd799439084";
const BOOKING_ID = "507f1f77bcf86cd799439085";

function makeDbMock() {
  const orderFindOne = vi.fn();
  const reviewFindOne = vi.fn();
  const reviewInsertOne = vi.fn();
  const seekerFindOne = vi.fn();
  const providerUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return { findOne: orderFindOne };
      }
      if (name === "reviews") {
        return { findOne: reviewFindOne, insertOne: reviewInsertOne };
      }
      if (name === "seekers") {
        return { findOne: seekerFindOne };
      }
      if (name === "providers") {
        return { updateOne: providerUpdateOne };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    orderFindOne,
    reviewFindOne,
    reviewInsertOne,
    seekerFindOne,
    providerUpdateOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reviews", () => {
  beforeEach(() => {
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        email: "seeker@laundryease.test",
        name: "Seeker Test",
      },
    });
    mockGetDb.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects provider mismatch for a booking", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      booking_id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        booking_id: BOOKING_ID,
        provider_id: OTHER_PROVIDER_ID,
        rating: 4,
        comment: "Good work",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Provider mismatch for this booking");
    expect(dbMock.reviewFindOne).not.toHaveBeenCalled();
    expect(dbMock.reviewInsertOne).not.toHaveBeenCalled();
    expect(dbMock.providerUpdateOne).not.toHaveBeenCalled();
  });

  it("creates review and updates provider aggregate from order provider id", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      booking_id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
    });
    dbMock.reviewFindOne.mockResolvedValue(null);
    dbMock.seekerFindOne.mockResolvedValue({ name: "Seeker Test" });
    dbMock.reviewInsertOne.mockResolvedValue({ acknowledged: true });
    dbMock.providerUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        booking_id: BOOKING_ID,
        rating: 5,
        comment: "Excellent",
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(dbMock.reviewInsertOne).toHaveBeenCalledOnce();
    expect(String(dbMock.reviewInsertOne.mock.calls[0][0].provider_id)).toBe(
      PROVIDER_ID,
    );

    expect(dbMock.providerUpdateOne).toHaveBeenCalledOnce();
    const [providerFilter, providerUpdate] = dbMock.providerUpdateOne.mock.calls[0];
    expect(String(providerFilter._id)).toBe(PROVIDER_ID);
    expect(Array.isArray(providerUpdate)).toBe(true);
  });

  it("returns 400 for invalid booking id", async () => {
    const res = await POST(
      makeRequest({
        booking_id: "not-an-object-id",
        provider_id: PROVIDER_ID,
        rating: 4,
      }) as never,
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid booking ID");
    expect(mockGetDb).not.toHaveBeenCalled();
  });
});
