import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetOrderById,
  mockBuildConfirmDeliveryUpdateFields,
  mockRequireProvider,
  mockGetDb,
  mockEvaluateDeadlineCompensation,
  mockRefundRazorpayPayment,
} = vi.hoisted(() => ({
  mockGetOrderById: vi.fn(),
  mockBuildConfirmDeliveryUpdateFields: vi.fn(),
  mockRequireProvider: vi.fn(),
  mockGetDb: vi.fn(),
  mockEvaluateDeadlineCompensation: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  getOrderById: mockGetOrderById,
}));

vi.mock("@/lib/db/orders", () => ({
  buildConfirmDeliveryUpdateFields: mockBuildConfirmDeliveryUpdateFields,
}));

vi.mock("@/lib/api/auth", () => ({ requireProvider: mockRequireProvider }));

vi.mock("@/lib/api/security", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requireSameOrigin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mongodb", () => ({ getDb: mockGetDb }));

vi.mock("@/lib/orders/deadline-compensation", () => ({
  evaluateDeadlineCompensation: mockEvaluateDeadlineCompensation,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: mockRefundRazorpayPayment,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("bcrypt", () => ({
  compare: vi.fn().mockResolvedValue(true),
}));

import { POST } from "./route";

const providerId = new ObjectId();
const seekerId = new ObjectId();
const orderId = new ObjectId();

function makeReq(body: Record<string, unknown> = { otp: "123456" }) {
  return new Request(
    `https://laundryease.test/api/orders/${orderId}/otp/verify`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

function makeParams(id = orderId.toString()) {
  return { params: Promise.resolve({ id }) };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: orderId,
    seeker_id: seekerId,
    provider_id: providerId,
    payment_status: "paid",
    process_status: "out_for_delivery",
    delivery_otp: "$2b$10$hashedotp",
    delivery_otp_expires_at: new Date(Date.now() + 600_000),
    total_price: 500,
    ...overrides,
  };
}

function setupTransaction() {
  const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  const findOne = vi.fn().mockResolvedValue(makeOrder());
  const mockSession = {
    withTransaction: vi.fn(async (fn: () => Promise<Response>) => fn()),
    endSession: vi.fn(),
  };
  const mockClient = { startSession: vi.fn().mockReturnValue(mockSession) };
  mockGetDb.mockResolvedValue({
    db: { collection: () => ({ updateOne, findOne }) },
    client: mockClient,
  });
  return { updateOne, findOne, mockSession };
}

describe("POST /api/orders/[id]/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProvider.mockResolvedValue({
      user: { id: providerId.toString(), role: "provider" },
    });
    mockGetOrderById.mockResolvedValue(makeOrder());
    mockBuildConfirmDeliveryUpdateFields.mockReturnValue({
      process_status: "delivered",
      otp_confirmed_at: new Date(),
      payment_status: "held",
      escrow_started_at: new Date(),
      escrow_release_at: new Date(),
    });
    mockEvaluateDeadlineCompensation.mockReturnValue({
      deadlineBreached: false,
      shouldRefund: false,
      blocked: false,
    });
    // Default transaction setup — needed since OTP checks run inside the service
    setupTransaction();
  });

  it("returns 400 for invalid order id", async () => {
    const res = await POST(makeReq(), makeParams("bad-id"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid OTP format", async () => {
    const res = await POST(makeReq({ otp: "abc" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found", async () => {
    mockGetOrderById.mockResolvedValue(null);
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when provider does not own the order", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ provider_id: new ObjectId() }),
    );
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 idempotent when already delivered", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ process_status: "delivered" }),
    );
    const res = await POST(makeReq(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.idempotent).toBe(true);
  });

  it("returns 409 when order is not out_for_delivery", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ process_status: "washing" }),
    );
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(409);
  });

  it("returns 400 when order is unpaid", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ payment_status: "unpaid" }),
    );
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 410 when OTP is expired", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({
        delivery_otp_expires_at: new Date(Date.now() - 60_000),
      }),
    );
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(410);
  });

  it("returns 400 when OTP is invalid", async () => {
    const bcrypt = await import("bcrypt");
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(400);
  });

  it("verifies OTP and confirms delivery successfully", async () => {
    const res = await POST(makeReq(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain("Delivery confirmed");
  });

  it("handles deadline breach with refund", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ razorpay_payment_id: "pay_test123" }),
    );
    mockEvaluateDeadlineCompensation.mockReturnValue({
      deadlineBreached: true,
      shouldRefund: true,
      blocked: false,
    });
    mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_test123" });
    setupTransaction();

    const res = await POST(makeReq(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.deadlineBreached).toBe(true);
    expect(body.data.deadlineCompensationApplied).toBe(true);
    expect(mockRefundRazorpayPayment).toHaveBeenCalled();
  });

  it("returns 409 when compensation is blocked", async () => {
    mockEvaluateDeadlineCompensation.mockReturnValue({
      deadlineBreached: true,
      shouldRefund: false,
      blocked: true,
      blockedMessage: "Cannot auto-compensate",
    });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(409);
  });
});
