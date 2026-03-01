import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireSeeker,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockRazorpayCreateOrder,
} = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockRazorpayCreateOrder: vi.fn(),
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

vi.mock("@/lib/env", () => ({
  env: {
    RAZORPAY_KEY_ID: "rzp_test_key",
    RAZORPAY_KEY_SECRET: "rzp_test_secret",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_public_key",
  },
}));

vi.mock("razorpay", () => ({
  default: class Razorpay {
    orders = {
      create: mockRazorpayCreateOrder,
    };
  },
}));

import { POST } from "./route";

const SEEKER_ID = "507f1f77bcf86cd799439011";
const BOOKING_ID = "507f1f77bcf86cd799439012";

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/payments/create-order", {
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
  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return {
          findOne: bookingsFindOne,
          updateOne: bookingsUpdateOne,
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return {
    db,
    bookingsFindOne,
    bookingsUpdateOne,
  };
}

describe("POST /api/payments/create-order", () => {
  beforeEach(() => {
    mockRequireSeeker.mockReset();
    mockGetDb.mockReset();
    mockRequireSameOrigin.mockReset();
    mockEnforceRateLimit.mockReset();
    mockRazorpayCreateOrder.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps auth helper errors without converting to 500", async () => {
    mockRequireSeeker.mockRejectedValueOnce(
      new AppError(ErrorCode.FORBIDDEN, 403, "Seeker role required"),
    );

    const res = await POST(makeRequest({ bookingId: BOOKING_ID }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.message).toBe("Seeker role required");
  });

  it("returns 400 when payload is invalid", async () => {
    mockRequireSeeker.mockResolvedValue({
      user: { id: SEEKER_ID, email: "seeker@laundryease.test" },
    });

    const res = await POST(makeRequest({ bookingId: "invalid-id" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toBe("Invalid booking payment request");
  });

  it("returns 404 when booking is missing", async () => {
    const dbMock = makeDbMock();
    dbMock.bookingsFindOne.mockResolvedValue(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRequireSeeker.mockResolvedValue({
      user: { id: SEEKER_ID, email: "seeker@laundryease.test" },
    });

    const res = await POST(makeRequest({ bookingId: BOOKING_ID }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.message).toBe("Booking not found");
  });

  it("creates Razorpay order from server-side booking fee, ignoring client amount", async () => {
    const dbMock = makeDbMock();
    dbMock.bookingsFindOne.mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      status: "requested",
      bookingFeeStatus: "pending",
      bookingFee: 149,
    });
    dbMock.bookingsUpdateOne.mockResolvedValue({ acknowledged: true });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRequireSeeker.mockResolvedValue({
      user: { id: SEEKER_ID, email: "seeker@laundryease.test" },
    });
    mockRazorpayCreateOrder.mockResolvedValue({
      id: "order_test_123",
      amount: 14900,
      currency: "INR",
    });

    const res = await POST(
      makeRequest({
        bookingId: BOOKING_ID,
        amount: 1,
        currency: "USD",
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockRazorpayCreateOrder).toHaveBeenCalledOnce();
    expect(mockRazorpayCreateOrder).toHaveBeenCalledWith({
      amount: 14900,
      currency: "INR",
      receipt: BOOKING_ID,
      payment_capture: true,
    });
    expect(data.data.orderId).toBe("order_test_123");
    expect(data.data.amount).toBe(14900);
    expect(data.data.currency).toBe("INR");
    expect(data.data.key).toBe("rzp_public_key");
  });
});
