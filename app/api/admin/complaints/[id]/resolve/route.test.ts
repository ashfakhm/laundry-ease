import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireAdminWithDbCheck,
  mockGetDb,
  mockGetOrderById,
  mockRefundRazorpayPayment,
  mockInitiateOrderPayout,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetOrderById: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
  mockInitiateOrderPayout: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db/index", () => ({
  getOrderById: mockGetOrderById,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: mockRefundRazorpayPayment,
}));

vi.mock("@/lib/payouts", () => ({
  initiateOrderPayout: mockInitiateOrderPayout,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from "./route";

function makeDbMock() {
  const complaintsFindOne = vi.fn();
  const complaintsUpdateOne = vi.fn();
  const ordersUpdateOne = vi.fn();
  const complaintMessagesInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return {
          findOne: complaintsFindOne,
          updateOne: complaintsUpdateOne,
        };
      }

      if (name === "orders") {
        return {
          updateOne: ordersUpdateOne,
        };
      }

      if (name === "complaint_messages") {
        return {
          insertOne: complaintMessagesInsertOne,
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return {
    db,
    complaintsFindOne,
    complaintsUpdateOne,
    ordersUpdateOne,
    complaintMessagesInsertOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/admin/complaints/123/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/complaints/[id]/resolve", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 40,
      remaining: 39,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: Role.ADMIN,
        email: "admin@laundryease.test",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid complaint id", async () => {
    const res = await POST(makeRequest({ outcome: "reject" }), {
      params: Promise.resolve({ id: "bad-id" }),
    });

    expect(res.status).toBe(400);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("rejects complaint and releases provider payout minus commission", async () => {
    const complaintId = new ObjectId();
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintsFindOne.mockResolvedValue({
      _id: complaintId,
      status: "in_review",
      order_id: orderId,
    });
    dbMock.complaintsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.complaintMessagesInsertOne.mockResolvedValue({ acknowledged: true });

    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      total_price: 100,
      provider_payout_amount: 95,
      platform_commission: 5,
      razorpay_payment_id: "pay_reject_case",
    });
    mockInitiateOrderPayout.mockResolvedValue({
      status: "payout_initiated",
      message: "ok",
    });

    const res = await POST(makeRequest({ outcome: "reject" }), {
      params: Promise.resolve({ id: complaintId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("rejected");
    expect(data.data.outcome).toBe("release_payout");
    expect(data.data.settlement).toEqual({
      seeker_refund_amount: 0,
      provider_payout_amount: 95,
      platform_commission: 5,
      distributable_amount: 95,
    });

    expect(mockInitiateOrderPayout).toHaveBeenCalledWith(orderId, {
      ignoreEscrowDate: true,
      source: "complaint_reject",
      overrideProviderPayoutAmount: 95,
      overridePlatformCommission: 5,
    });
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
    expect(dbMock.complaintsUpdateOne).toHaveBeenCalledWith(
      { _id: complaintId },
      {
        $set: expect.objectContaining({
          status: "rejected",
          resolution_outcome: "release_payout",
          provider_access_granted: false,
        }),
      },
    );
  });

  it("resolves with partial refund split and records payout + refund amounts", async () => {
    const complaintId = new ObjectId();
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintsFindOne.mockResolvedValue({
      _id: complaintId,
      status: "accepted",
      order_id: orderId,
    });
    dbMock.complaintsUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.ordersUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.complaintMessagesInsertOne.mockResolvedValue({ acknowledged: true });

    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      total_price: 100,
      provider_payout_amount: 95,
      platform_commission: 5,
      razorpay_payment_id: "pay_partial_case",
    });
    mockInitiateOrderPayout.mockResolvedValue({
      status: "payout_initiated",
      message: "ok",
    });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_partial_case" });

    const res = await POST(
      makeRequest({ outcome: "refund_partial", seeker_refund_amount: 30 }),
      {
        params: Promise.resolve({ id: complaintId.toString() }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("resolved");
    expect(data.data.outcome).toBe("refund_partial");
    expect(data.data.settlement).toEqual({
      seeker_refund_amount: 30,
      provider_payout_amount: 65,
      platform_commission: 5,
      distributable_amount: 95,
    });

    expect(mockInitiateOrderPayout).toHaveBeenCalledWith(orderId, {
      ignoreEscrowDate: true,
      source: "complaint_refund_partial",
      overrideProviderPayoutAmount: 65,
      overridePlatformCommission: 5,
    });
    expect(mockRefundRazorpayPayment).toHaveBeenCalledWith(
      "pay_partial_case",
      3000,
      expect.objectContaining({
        source: "complaint_resolution",
        complaint_id: complaintId.toString(),
        outcome: "refund_partial",
      }),
    );
    expect(dbMock.ordersUpdateOne).toHaveBeenCalledWith(
      { _id: orderId },
      expect.objectContaining({
        $set: expect.objectContaining({
          provider_payout_amount: 65,
          platform_commission: 5,
          refund_amount: 30,
          razorpay_refund_id: "rfnd_partial_case",
        }),
      }),
    );
  });

  it("returns 400 when partial refund exceeds distributable amount", async () => {
    const complaintId = new ObjectId();
    const orderId = new ObjectId();
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.complaintsFindOne.mockResolvedValue({
      _id: complaintId,
      status: "accepted",
      order_id: orderId,
    });

    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      total_price: 100,
      provider_payout_amount: 95,
      platform_commission: 5,
      razorpay_payment_id: "pay_over_limit_case",
    });

    const res = await POST(
      makeRequest({ outcome: "refund_partial", seeker_refund_amount: 120 }),
      {
        params: Promise.resolve({ id: complaintId.toString() }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("seeker_refund_amount must be within 0 and 95.00.");
    expect(mockInitiateOrderPayout).not.toHaveBeenCalled();
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
  });
});
