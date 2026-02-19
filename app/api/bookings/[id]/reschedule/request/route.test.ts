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

const BOOKING_ID = new ObjectId().toString();
const SEEKER_ID = new ObjectId().toString();
const PROVIDER_ID = new ObjectId().toString();

type BookingDoc = {
  _id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  status: string;
  arrivedAt?: Date;
  pickupSlot?: {
    dateTime?: Date;
    confirmedAt?: Date;
  };
  reschedule?: {
    count?: number;
  };
};

function makeDbMock() {
  const findOne = vi.fn();
  const updateOne = vi.fn();
  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
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

function makeRequest(bookingId: string, body: unknown = {}) {
  return new Request(
    `https://laundryease.test/api/bookings/${bookingId}/reschedule/request`,
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

function makeContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function makeBooking(overrides: Partial<BookingDoc> = {}): BookingDoc {
  return {
    _id: new ObjectId(BOOKING_ID),
    seeker_id: new ObjectId(SEEKER_ID),
    provider_id: new ObjectId(PROVIDER_ID),
    status: "confirmed",
    pickupSlot: { dateTime: new Date(), confirmedAt: new Date() },
    reschedule: { count: 0 },
    ...overrides,
  };
}

describe("POST /api/bookings/[id]/reschedule/request", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockGetDb.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid booking id", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });

    const res = await POST(makeRequest("bad-id"), makeContext("bad-id"));
    expect(res.status).toBe(400);
  });

  it("allows seeker owner to request reschedule", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue(makeBooking());
    dbMock.updateOne.mockResolvedValue({ matchedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest(BOOKING_ID, { reason: "Need later slot" }),
      makeContext(BOOKING_ID),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(dbMock.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "reschedule_requested",
          reschedule: expect.objectContaining({
            requestedBy: "seeker",
          }),
        }),
      }),
    );
  });

  it("allows provider owner without email lookup dependency", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: PROVIDER_ID, role: Role.PROVIDER, email: null },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue(makeBooking());
    dbMock.updateOne.mockResolvedValue({ matchedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest(BOOKING_ID, { reason: "Delayed traffic" }),
      makeContext(BOOKING_ID),
    );

    expect(res.status).toBe(200);
    expect(dbMock.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          reschedule: expect.objectContaining({
            requestedBy: "provider",
          }),
        }),
      }),
    );
  });

  it("returns 403 for non-owner", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: Role.SEEKER,
        email: "other@test.com",
      },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue(makeBooking());
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(makeRequest(BOOKING_ID), makeContext(BOOKING_ID));
    expect(res.status).toBe(403);
  });

  it("returns 422 for non-reschedulable booking status", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });

    const dbMock = makeDbMock();
    dbMock.findOne.mockResolvedValue(
      makeBooking({
        status: "cancelled",
      }),
    );
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(makeRequest(BOOKING_ID), makeContext(BOOKING_ID));
    expect(res.status).toBe(422);
  });
});
