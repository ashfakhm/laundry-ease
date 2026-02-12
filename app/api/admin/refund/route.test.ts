import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockGetServerSession,
  mockGetDb,
  mockRefundRazorpayPayment,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetDb: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
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

import { POST } from "./route";

const ORDER_ID = "507f1f77bcf86cd799439011";
const BOOKING_ID = "507f1f77bcf86cd799439012";

function makeDbMock() {
  const orderFindOne = vi.fn();
  const bookingFindOne = vi.fn();
  const orderUpdateOne = vi.fn();
  const bookingUpdateOne = vi.fn();
  const adminLogsInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          findOne: orderFindOne,
          updateOne: orderUpdateOne,
        };
      }
      if (name === "bookings") {
        return {
          findOne: bookingFindOne,
          updateOne: bookingUpdateOne,
        };
      }
      if (name === "admin_logs") {
        return {
          insertOne: adminLogsInsertOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    orderFindOne,
    bookingFindOne,
    orderUpdateOne,
    bookingUpdateOne,
    adminLogsInsertOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/admin/refund", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/refund", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 30,
      remaining: 29,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRefundRazorpayPayment.mockReset();
    mockGetDb.mockReset();
    mockGetServerSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when actor is not admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: Role.SEEKER, email: "seeker@test.com" },
    });
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        paymentId: "pay_1",
        orderId: ORDER_ID,
        reason: "Unauthorized refund attempt",
      }),
    );

    expect(res.status).toBe(401);
    expect(dbMock.orderFindOne).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid target payload", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com" },
    });
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        paymentId: "pay_1",
        reason: "Missing order or booking target",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid refund data");
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
  });

  it("refunds an eligible order and persists refund metadata", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com" },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "paid",
      total_price: 499,
      razorpay_payment_id: "pay_order_1",
    });
    dbMock.orderUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.adminLogsInsertOne.mockResolvedValue({ acknowledged: true });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_1" });

    const res = await POST(
      makeRequest({
        paymentId: "pay_order_1",
        orderId: ORDER_ID,
        reason: "Dispute resolved in seeker favor",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalledWith(
      "pay_order_1",
      49900,
      expect.objectContaining({
        source: "admin_refund_route",
        order_id: ORDER_ID,
      }),
    );
    expect(dbMock.orderUpdateOne).toHaveBeenCalledOnce();
    expect(dbMock.adminLogsInsertOne).toHaveBeenCalledOnce();
  });

  it("returns idempotent success when order is already refunded", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com" },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "refunded",
      total_price: 499,
      razorpay_payment_id: "pay_order_1",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        paymentId: "pay_order_1",
        orderId: ORDER_ID,
        reason: "Duplicate refund trigger",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.idempotent).toBe(true);
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
    expect(dbMock.orderUpdateOne).not.toHaveBeenCalled();
    expect(dbMock.adminLogsInsertOne).not.toHaveBeenCalled();
  });

  it("refunds a booking fee when booking is in paid state", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com" },
    });
    const dbMock = makeDbMock();
    dbMock.bookingFindOne.mockResolvedValue({
      _id: new ObjectId(BOOKING_ID),
      bookingFeeStatus: "paid",
      bookingFee: 99,
      razorpay_payment_id: "pay_booking_1",
    });
    dbMock.bookingUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.adminLogsInsertOne.mockResolvedValue({ acknowledged: true });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_booking_1" });

    const res = await POST(
      makeRequest({
        paymentId: "pay_booking_1",
        bookingId: BOOKING_ID,
        reason: "Provider rejected booking",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalledWith(
      "pay_booking_1",
      9900,
      expect.objectContaining({
        source: "admin_refund_route",
        booking_id: BOOKING_ID,
      }),
    );
    expect(dbMock.bookingUpdateOne).toHaveBeenCalledOnce();
  });
});
