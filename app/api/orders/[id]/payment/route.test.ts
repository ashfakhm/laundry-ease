import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireSeeker,
  mockGetDb,
  mockCreateRazorpayOrder,
  mockVerifyRazorpaySignature,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockGetDb: vi.fn(),
  mockCreateRazorpayOrder: vi.fn(),
  mockVerifyRazorpaySignature: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/razorpay", () => ({
  createRazorpayOrder: mockCreateRazorpayOrder,
  verifyRazorpaySignature: mockVerifyRazorpaySignature,
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

import { POST, PUT } from "./route";

const ORDER_ID = "507f1f77bcf86cd799439061";
const SEEKER_ID = "507f1f77bcf86cd799439062";

function makeDbMock() {
  const orderFindOne = vi.fn();
  const orderUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          findOne: orderFindOne,
          updateOne: orderUpdateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    orderFindOne,
    orderUpdateOne,
  };
}

function makeRequest(method: "POST" | "PUT", body: unknown) {
  return new Request(
    `https://laundryease.test/api/orders/${ORDER_ID}/payment`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        origin: "https://laundryease.test",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("order payment route", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 10,
      remaining: 9,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireSeeker.mockResolvedValue({
      user: { id: SEEKER_ID, role: Role.SEEKER, email: "seeker@test.com" },
    });
    mockCreateRazorpayOrder.mockReset();
    mockVerifyRazorpaySignature.mockReset();
    mockGetDb.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates payment order for unpaid order", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      payment_status: "unpaid",
      total_price: 499,
    });
    dbMock.orderUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockCreateRazorpayOrder.mockResolvedValue({
      id: "order_rzp_1",
      amount: 49900,
      currency: "INR",
    });

    const res = await POST(makeRequest("POST", {}), {
      params: Promise.resolve({ id: ORDER_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.id).toBe("order_rzp_1");
    expect(mockCreateRazorpayOrder).toHaveBeenCalledWith(49900, ORDER_ID);
    expect(dbMock.orderUpdateOne).toHaveBeenCalledOnce();
  });

  it("returns idempotent success when payment already captured with same payment id", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      payment_status: "paid",
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await PUT(
      makeRequest("PUT", {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.idempotent).toBe(true);
    expect(mockVerifyRazorpaySignature).not.toHaveBeenCalled();
  });

  it("rejects mismatched payment re-verify when order is already paid", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      payment_status: "paid",
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_existing",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await PUT(
      makeRequest("PUT", {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_other",
        razorpay_signature: "sig",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.message).toBe("Order is already paid");
  });

  it("marks unpaid order as paid after signature verification", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      payment_status: "unpaid",
      process_status: "invoiced",
      razorpay_order_id: "order_1",
    });
    dbMock.orderUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockVerifyRazorpaySignature.mockReturnValue(true);

    const res = await PUT(
      makeRequest("PUT", {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig_1",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.updated).toBe(true);
    expect(mockVerifyRazorpaySignature).toHaveBeenCalledWith(
      "order_1",
      "pay_1",
      "sig_1",
    );
    expect(dbMock.orderUpdateOne).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId), payment_status: "unpaid" },
      expect.objectContaining({
        $set: expect.objectContaining({
          payment_status: "paid",
          razorpay_payment_id: "pay_1",
        }),
      }),
    );
  });

  it("returns idempotent response when concurrent update already captured same payment id", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne
      .mockResolvedValueOnce({
        _id: new ObjectId(ORDER_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        payment_status: "unpaid",
        process_status: "invoiced",
        razorpay_order_id: "order_1",
      })
      .mockResolvedValueOnce({
        _id: new ObjectId(ORDER_ID),
        seeker_id: new ObjectId(SEEKER_ID),
        payment_status: "held",
        razorpay_payment_id: "pay_2",
      });
    dbMock.orderUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockVerifyRazorpaySignature.mockReturnValue(true);

    const res = await PUT(
      makeRequest("PUT", {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_2",
        razorpay_signature: "sig_2",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.idempotent).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      seeker_id: new ObjectId(SEEKER_ID),
      payment_status: "unpaid",
      razorpay_order_id: "order_1",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockVerifyRazorpaySignature.mockReturnValue(false);

    const res = await PUT(
      makeRequest("PUT", {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_invalid",
        razorpay_signature: "sig_invalid",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toBe("Invalid signature");
    expect(dbMock.orderUpdateOne).not.toHaveBeenCalled();
  });
});
