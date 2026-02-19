import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireSeeker,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockGetBookingById,
  mockGetDb,
  mockVerifyRazorpaySignature,
  mockCreateRazorpayOrder,
} = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockGetBookingById: vi.fn(),
  mockGetDb: vi.fn(),
  mockVerifyRazorpaySignature: vi.fn(),
  mockCreateRazorpayOrder: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/db/index", () => ({
  getBookingById: mockGetBookingById,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/razorpay", () => ({
  verifyRazorpaySignature: mockVerifyRazorpaySignature,
  createRazorpayOrder: mockCreateRazorpayOrder,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PUT } from "./route";

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/bookings/id/pay-invoice", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

function makeDbMock() {
  const ordersFindOne = vi.fn();
  const ordersInsertOne = vi.fn();
  const ordersDeleteOne = vi.fn();
  const providersFindOne = vi.fn();
  const bookingsUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          findOne: ordersFindOne,
          insertOne: ordersInsertOne,
          deleteOne: ordersDeleteOne,
        };
      }
      if (name === "providers") {
        return {
          findOne: providersFindOne,
        };
      }
      if (name === "bookings") {
        return {
          updateOne: bookingsUpdateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    ordersFindOne,
    ordersInsertOne,
    ordersDeleteOne,
    providersFindOne,
    bookingsUpdateOne,
  };
}

describe("PUT /api/bookings/[id]/pay-invoice", () => {
  const seekerId = new ObjectId();
  const providerId = new ObjectId();
  const bookingId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 10,
      remaining: 9,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireSeeker.mockResolvedValue({
      user: {
        id: seekerId.toString(),
        role: Role.SEEKER,
        email: "seeker@laundryease.test",
      },
    });
    mockVerifyRazorpaySignature.mockReturnValue(true);
    mockCreateRazorpayOrder.mockResolvedValue({
      id: "rzp_order_mock",
      amount: 1000,
      currency: "INR",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rolls back inserted order when booking state update loses race", async () => {
    const dbMock = makeDbMock();
    const insertedOrderId = new ObjectId();
    dbMock.ordersFindOne.mockResolvedValue(null);
    dbMock.providersFindOne.mockResolvedValue(null);
    dbMock.ordersInsertOne.mockResolvedValue({ insertedId: insertedOrderId });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    dbMock.ordersDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    mockGetBookingById.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: providerId,
      status: "invoice_created",
      razorpay_order_id: "rzp_order_123",
      invoice: {
        items: [{ itemType: "Shirt", quantity: 2, unitPrice: 50 }],
      },
      createdAt: new Date(),
    });

    const res = await PUT(
      makeRequest({
        razorpay_order_id: "rzp_order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "sig_123",
      }),
      { params: Promise.resolve({ id: bookingId.toString() }) },
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.message).toContain("Booking state changed while finalizing order");
    expect(dbMock.ordersDeleteOne).toHaveBeenCalledWith({
      _id: insertedOrderId,
      booking_id: expect.any(ObjectId),
    });
  });

  it("returns idempotent success when booking already has order_id", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    const existingOrderId = new ObjectId();

    mockGetBookingById.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: providerId,
      status: "completed",
      order_id: existingOrderId,
      createdAt: new Date(),
    });

    const res = await PUT(
      makeRequest({
        razorpay_order_id: "rzp_order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "sig_123",
      }),
      { params: Promise.resolve({ id: bookingId.toString() }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(String(data.orderId)).toBe(existingOrderId.toString());
    expect(dbMock.ordersInsertOne).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payment fields", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await PUT(
      makeRequest({
        razorpay_order_id: "rzp_order_123",
        razorpay_signature: "sig_123",
      }),
      { params: Promise.resolve({ id: bookingId.toString() }) },
    );

    expect(res.status).toBe(400);
  });
});
