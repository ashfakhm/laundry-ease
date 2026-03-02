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
  const bookingsFindOne = vi.fn();
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
          findOne: bookingsFindOne,
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
    bookingsFindOne,
    bookingsUpdateOne,
  };
}

function makeClientMock() {
  const withTransaction = vi.fn(async (fn: () => Promise<void>) => {
    await fn();
  });
  const endSession = vi.fn(async () => undefined);
  const startSession = vi.fn(() => ({
    withTransaction,
    endSession,
  }));

  return {
    client: { startSession },
    startSession,
    withTransaction,
    endSession,
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

  it("returns conflict when booking state update loses race inside transaction", async () => {
    const dbMock = makeDbMock();
    const clientMock = makeClientMock();
    const insertedOrderId = new ObjectId();
    dbMock.ordersFindOne.mockResolvedValue(null);
    dbMock.providersFindOne.mockResolvedValue(null);
    dbMock.bookingsFindOne.mockResolvedValue(null);
    dbMock.ordersInsertOne.mockResolvedValue({ insertedId: insertedOrderId });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    dbMock.ordersDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: clientMock.client });

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
    expect(data.message).toContain(
      "Booking state changed while finalizing order",
    );
    expect(dbMock.ordersDeleteOne).not.toHaveBeenCalled();
    expect(clientMock.startSession).toHaveBeenCalledTimes(1);
    expect(clientMock.withTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns idempotent success when booking already has order_id", async () => {
    const dbMock = makeDbMock();
    const clientMock = makeClientMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: clientMock.client });
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
    expect(String(data.data.orderId)).toBe(existingOrderId.toString());
    expect(dbMock.ordersInsertOne).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payment fields", async () => {
    const dbMock = makeDbMock();
    const clientMock = makeClientMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: clientMock.client });

    const res = await PUT(
      makeRequest({
        razorpay_order_id: "rzp_order_123",
        razorpay_signature: "sig_123",
      }),
      { params: Promise.resolve({ id: bookingId.toString() }) },
    );

    expect(res.status).toBe(400);
  });

  it("stores subtotal, discount and computes commission from pre-discount subtotal", async () => {
    const dbMock = makeDbMock();
    const clientMock = makeClientMock();
    const insertedOrderId = new ObjectId();

    // First findOne (duplicate check) → null, second findOne (booking link race) → null
    dbMock.ordersFindOne.mockResolvedValue(null);
    dbMock.providersFindOne.mockResolvedValue(null); // no provider → delivery_charge = 0
    dbMock.ordersInsertOne.mockResolvedValue({ insertedId: insertedOrderId });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: clientMock.client });

    // Invoice with subtotal=1000, discount=200 → items total before discount
    mockGetBookingById.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: providerId,
      status: "invoice_created",
      razorpay_order_id: "rzp_order_456",
      invoice: {
        items: [
          { itemType: "Shirt", quantity: 5, unitPrice: 100 },
          { itemType: "Pants", quantity: 5, unitPrice: 100 },
        ],
        subtotal: 1000,
        discount: 200,
        total: 800,
      },
      createdAt: new Date(),
    });

    const res = await PUT(
      makeRequest({
        razorpay_order_id: "rzp_order_456",
        razorpay_payment_id: "pay_456",
        razorpay_signature: "sig_456",
      }),
      { params: Promise.resolve({ id: bookingId.toString() }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.orderId).toBeDefined();

    // Verify the order data passed to insertOne
    expect(dbMock.ordersInsertOne).toHaveBeenCalledTimes(1);
    const orderData = dbMock.ordersInsertOne.mock.calls[0][0];

    // subtotal and discount persisted on the order
    expect(orderData.subtotal).toBe(1000);
    expect(orderData.discount).toBe(200);

    // total_price = max(0, 1000 - 200) + 0 (no delivery) = 800
    expect(orderData.total_price).toBe(800);

    // Commission is 5% of pre-discount subtotal (1000), NOT 5% of total (800)
    // platform_commission = round2(1000 * 0.05) = 50
    expect(orderData.platform_commission).toBe(50);

    // provider_payout = round2(800 - 50) = 750
    expect(orderData.provider_payout_amount).toBe(750);
  });

  it("falls back to items sum when invoice lacks explicit subtotal", async () => {
    const dbMock = makeDbMock();
    const clientMock = makeClientMock();
    const insertedOrderId = new ObjectId();

    dbMock.ordersFindOne.mockResolvedValue(null);
    dbMock.providersFindOne.mockResolvedValue(null);
    dbMock.ordersInsertOne.mockResolvedValue({ insertedId: insertedOrderId });
    dbMock.bookingsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db, client: clientMock.client });

    // Invoice without explicit subtotal/discount fields
    mockGetBookingById.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: providerId,
      status: "invoice_created",
      razorpay_order_id: "rzp_order_789",
      invoice: {
        items: [{ itemType: "Shirt", quantity: 2, unitPrice: 50 }],
      },
      createdAt: new Date(),
    });

    const res = await PUT(
      makeRequest({
        razorpay_order_id: "rzp_order_789",
        razorpay_payment_id: "pay_789",
        razorpay_signature: "sig_789",
      }),
      { params: Promise.resolve({ id: bookingId.toString() }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const orderData = dbMock.ordersInsertOne.mock.calls[0][0];

    // subtotal falls back to items sum: 2 * 50 = 100
    expect(orderData.subtotal).toBe(100);
    // discount defaults to 0
    expect(orderData.discount).toBe(0);
    // total_price = 100 - 0 + 0 = 100
    expect(orderData.total_price).toBe(100);
    // commission = 5% of 100 = 5
    expect(orderData.platform_commission).toBe(5);
    // provider payout = 100 - 5 = 95
    expect(orderData.provider_payout_amount).toBe(95);
  });
});
