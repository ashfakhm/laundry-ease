import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireAdminWithDbCheck,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockRefundRazorpayPayment,
  mockInitiateOrderPayout,
} = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
  mockInitiateOrderPayout: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: mockRefundRazorpayPayment,
}));

vi.mock("@/lib/payouts", () => ({
  initiateOrderPayout: mockInitiateOrderPayout,
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

function makeDbMock() {
  const orderFindOne = vi.fn();
  const orderUpdateOne = vi.fn();
  const adminLogsInsertOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          findOne: orderFindOne,
          updateOne: orderUpdateOne,
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
    orderUpdateOne,
    adminLogsInsertOne,
  };
}

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/admin/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/payments", () => {
  beforeEach(() => {
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 40,
      remaining: 39,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireAdminWithDbCheck.mockReset();
    mockGetDb.mockReset();
    mockRefundRazorpayPayment.mockReset();
    mockInitiateOrderPayout.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when actor is not admin", async () => {
    mockRequireAdminWithDbCheck.mockRejectedValue(
      new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
    );
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        orderId: ORDER_ID,
        action: "release_payout",
      }),
    );

    expect(res.status).toBe(401);
    expect(dbMock.orderFindOne).not.toHaveBeenCalled();
  });

  it("releases payout when action is release_payout and payout is eligible", async () => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com", id: ORDER_ID },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "released",
      total_price: 500,
    });
    dbMock.adminLogsInsertOne.mockResolvedValue({ acknowledged: true });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockInitiateOrderPayout.mockResolvedValue({
      orderId: ORDER_ID,
      status: "payout_initiated",
      payoutId: "pout_1",
    });

    const res = await POST(
      makeRequest({
        orderId: ORDER_ID,
        action: "release_payout",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockInitiateOrderPayout).toHaveBeenCalledWith(
      expect.any(ObjectId),
      expect.objectContaining({
        ignoreEscrowDate: true,
        source: "admin_payments_manual_release",
      }),
    );
    expect(dbMock.adminLogsInsertOne).toHaveBeenCalledOnce();
  });

  it("returns 409 when release_payout is blocked", async () => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com", id: ORDER_ID },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "held",
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockInitiateOrderPayout.mockResolvedValue({
      orderId: ORDER_ID,
      status: "blocked_by_complaint",
      message: "Complaint is still open",
    });

    const res = await POST(
      makeRequest({
        orderId: ORDER_ID,
        action: "release_payout",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error.message).toContain("Complaint is still open");
  });

  it("returns conflict for refund when payout has already started", async () => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com", id: ORDER_ID },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "released",
      razorpay_payment_id: "pay_order_1",
      payout_id: "pout_existing",
      payout_status: "processing",
      total_price: 350,
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        orderId: ORDER_ID,
        action: "refund",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error.message).toContain("Cannot auto-refund after payout");
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();
  });

  it("refunds order from admin payments action and records audit log", async () => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com", id: ORDER_ID },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "held",
      razorpay_payment_id: "pay_order_1",
      total_price: 321,
    });
    dbMock.orderUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.adminLogsInsertOne.mockResolvedValue({ acknowledged: true });
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_order_1" });

    const res = await POST(
      makeRequest({
        orderId: ORDER_ID,
        action: "refund",
        reason: "Manual correction for failed delivery",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalledWith(
      "pay_order_1",
      32100,
      expect.objectContaining({
        reason: "Manual correction for failed delivery",
        order_id: ORDER_ID,
      }),
    );
    expect(dbMock.orderUpdateOne).toHaveBeenCalledOnce();
    expect(dbMock.adminLogsInsertOne).toHaveBeenCalledOnce();
  });

  it("validates penalty action requires amount and reason", async () => {
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: { role: Role.ADMIN, email: "admin@test.com", id: ORDER_ID },
    });
    const dbMock = makeDbMock();
    dbMock.orderFindOne.mockResolvedValue({
      _id: new ObjectId(ORDER_ID),
      payment_status: "released",
      total_price: 250,
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await POST(
      makeRequest({
        orderId: ORDER_ID,
        action: "penalty",
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Penalty amount and reason are required");
  });
});
