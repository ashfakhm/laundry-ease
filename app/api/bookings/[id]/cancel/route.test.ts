import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireAuth,
  mockGetDb,
  mockRefundRazorpayPayment,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetDb: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: mockRefundRazorpayPayment,
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

// Mock getBookingById to isolate the route logic
vi.mock("@/lib/db/index", () => ({
  getBookingById: vi.fn(),
}));
import { getBookingById } from "@/lib/db/index";

import { POST } from "./route";

const BOOKING_ID = "507f1f77bcf86cd799439012";
const SEEKER_ID = "507f1f77bcf86cd799439013";
const PROVIDER_ID = "507f1f77bcf86cd799439014";

function makeDbMock() {
  const bookingUpdateOne = vi.fn();
  const bookingFindOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return {
          updateOne: bookingUpdateOne,
          findOne: bookingFindOne,
        };
      }
      if (name === "providers") {
        return {
          findOne: vi
            .fn()
            .mockResolvedValue({ _id: new ObjectId(PROVIDER_ID) }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    bookingUpdateOne,
    bookingFindOne,
  };
}

function makeRequest(body: unknown = {}) {
  return new Request(
    `https://laundryease.test/api/bookings/${BOOKING_ID}/cancel`,
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

describe("POST /api/bookings/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 15,
      remaining: 14,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new AppError(ErrorCode.UNAUTHORIZED, 401, "Authentication required"),
    );
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 if booking not found", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });
    vi.mocked(getBookingById).mockResolvedValue(null);

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("cancels booking with refund for seeker when cancelled ahead of time", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
      pickupSlot: { dateTime: tomorrow },
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "refund_1" });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalled();
    expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
          bookingFeeStatus: "refunded",
        }),
      }),
    );
  });

  it("cancels booking with forfeit for seeker when cancelled on the same day", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const tonight = new Date();
    tonight.setHours(23, 0, 0, 0);

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
      pickupSlot: { dateTime: tonight },
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.message).toContain("non-refundable");
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
    expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
          bookingFeeStatus: "forfeited",
        }),
      }),
    );
  });

  it("blocks seeker cancellation after the pickup slot time", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const past = new Date();
    past.setHours(past.getHours() - 1);

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      pickupSlot: { dateTime: past },
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      message: expect.stringContaining("only before the booked slot time"),
    });
  });

  it("allows provider cancellation anytime before arrival", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: PROVIDER_ID,
        role: Role.PROVIDER,
        email: "provider@test.com",
      },
    });

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "confirmed",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "refund_1" });

    const res = await POST(makeRequest({ reason: "Emergency" }), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    expect(res.status).toBe(200);
  });
});
