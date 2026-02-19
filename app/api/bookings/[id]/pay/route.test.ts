import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockRequireSeeker,
  mockGetDb,
  mockVerifyRazorpaySignature,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireSeeker: vi.fn(),
  mockGetDb: vi.fn(),
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
  createRazorpayOrder: vi.fn(),
  verifyRazorpaySignature: mockVerifyRazorpaySignature,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/db/index", () => ({
  getBookingById: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PUT } from "./route";

describe("PUT /api/bookings/[id]/pay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockVerifyRazorpaySignature.mockReturnValue(true);
    mockRequireSeeker.mockResolvedValue({
      user: { id: new ObjectId().toString(), role: "seeker" },
    });
  });

  it("returns compatibility error payload for invalid booking id", async () => {
    const req = new Request("https://laundryease.test/api/bookings/bad/pay", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        razorpay_payment_id: "pay_1",
        razorpay_order_id: "order_1",
        razorpay_signature: "sig_1",
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: "bad-id" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid booking id");
    expect(body.error).toBe("Invalid booking id");
  });

  it("returns compatibility success payload for idempotent paid booking", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();
    const paymentId = "pay_1";
    const orderId = "order_1";

    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });

    const findOne = vi.fn().mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      status: "requested",
      bookingFeeStatus: "paid",
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
    });
    mockGetDb.mockResolvedValue({
      db: {
        collection: vi.fn(() => ({
          findOne,
          updateOne: vi.fn(),
        })),
      },
    });

    const req = new Request(
      `https://laundryease.test/api/bookings/${bookingId.toString()}/pay`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: "sig_1",
        }),
      },
    );

    const res = await PUT(req, {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.idempotent).toBe(true);
    expect(body.message).toBe("Payment successful");
  });
});
