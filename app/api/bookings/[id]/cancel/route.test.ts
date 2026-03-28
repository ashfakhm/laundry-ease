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

// "now" in all tests: 2024-01-01T10:00:00Z
const NOW = new Date("2024-01-01T10:00:00Z");

/** Created 30 minutes ago — seeker is inside the 2-hour free-cancel window. */
const CREATED_WITHIN_WINDOW = new Date(NOW.getTime() - 30 * 60 * 1000);

/** Created 3 hours ago — seeker is outside the 2-hour free-cancel window. */
const CREATED_OUTSIDE_WINDOW = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);

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
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Auth & basic guards ──────────────────────────────────────────────────

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

  // ─── Seeker: within 2-hour free-cancel window → refund ───────────────────

  it("refunds booking fee when seeker cancels within 2-hour window", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const tomorrow = new Date(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
      createdAt: CREATED_WITHIN_WINDOW,
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

  it("refunds booking fee when seeker cancels within window and no pickup slot yet", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
      createdAt: CREATED_WITHIN_WINDOW,
      pickupSlot: undefined,
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "refund_2" });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });

    expect(res.status).toBe(200);
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

  // ─── Seeker: outside 2-hour window → forfeit ─────────────────────────────

  it("forfeits booking fee when seeker cancels after 2-hour window", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const tomorrow = new Date(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
      createdAt: CREATED_OUTSIDE_WINDOW,
      pickupSlot: { dateTime: tomorrow },
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

  it("forfeits booking fee when seeker cancels after window with no pickup slot", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_1",
      createdAt: CREATED_OUTSIDE_WINDOW,
      pickupSlot: undefined,
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

  // ─── Seeker: blocked after pickup slot time ───────────────────────────────

  it("blocks seeker cancellation after the pickup slot time", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const past = new Date(NOW);
    past.setHours(past.getHours() - 1);

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "paid",
      createdAt: CREATED_WITHIN_WINDOW,
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

  // ─── Provider: always refunds seeker ─────────────────────────────────────

  it("requires a reason when provider cancels", async () => {
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
      status: "accepted",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_reason_required",
      createdAt: CREATED_WITHIN_WINDOW,
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(makeRequest({}), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      message: "Provider cancellation reason is required",
    });
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
    expect(dbMock.bookingUpdateOne).not.toHaveBeenCalled();
  });

  it("refunds seeker booking fee when provider cancels (before arrival)", async () => {
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
      // booking created 3 days ago — well outside the seeker free window,
      // but provider cancellation should still trigger a full refund
      createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "refund_1" });

    const res = await POST(
      makeRequest({ reason: "Unable to meet the scheduled pickup time" }),
      {
        params: Promise.resolve({ id: BOOKING_ID }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalled();
    expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
          cancelledBy: "provider",
          cancellation_reason: "Unable to meet the scheduled pickup time",
          bookingFeeStatus: "refunded",
        }),
      }),
    );
  });

  it("refunds seeker booking fee when provider cancels an early-stage booking", async () => {
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
      status: "accepted",
      bookingFeeStatus: "paid",
      razorpay_payment_id: "pay_2",
      createdAt: CREATED_WITHIN_WINDOW,
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "refund_2" });

    const res = await POST(
      makeRequest({ reason: "  Family emergency at the shop  " }),
      {
        params: Promise.resolve({ id: BOOKING_ID }),
      },
    );

    expect(res.status).toBe(200);
    expect(mockRefundRazorpayPayment).toHaveBeenCalled();
    expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
          cancelledBy: "provider",
          cancellation_reason: "Family emergency at the shop",
          bookingFeeStatus: "refunded",
        }),
      }),
    );
  });

  it("blocks provider from cancelling after marking arrival", async () => {
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
      createdAt: CREATED_OUTSIDE_WINDOW,
      arrivedAt: new Date(NOW.getTime() - 15 * 60 * 1000), // arrived 15 min ago
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const res = await POST(makeRequest({ reason: "Emergency" }), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.message).toContain("after marking arrival");
  });

  // ─── No fee paid — no refund needed ──────────────────────────────────────

  it("cancels booking cleanly when no booking fee was paid", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: SEEKER_ID,
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    vi.mocked(getBookingById).mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      provider_id: new ObjectId(PROVIDER_ID),
      status: "requested",
      bookingFeeStatus: "pending",
      createdAt: CREATED_WITHIN_WINDOW,
    } as NonNullable<Awaited<ReturnType<typeof getBookingById>>>);

    const dbMock = makeDbMock();
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: BOOKING_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
    expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "cancelled",
        }),
      }),
    );
  });
});
