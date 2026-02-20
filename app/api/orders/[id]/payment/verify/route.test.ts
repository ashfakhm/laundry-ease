import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyOrderPayment } = vi.hoisted(() => ({
  mockVerifyOrderPayment: vi.fn(),
}));

vi.mock("../route", () => ({
  PUT: mockVerifyOrderPayment,
}));

import { POST } from "./route";

const ORDER_ID = "507f1f77bcf86cd799439061";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    `https://laundryease.test/api/orders/${ORDER_ID}/payment/verify`,
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

describe("POST /api/orders/[id]/payment/verify (legacy alias)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes camelCase payload before forwarding", async () => {
    mockVerifyOrderPayment.mockResolvedValue(
      Response.json(
        { success: true, data: { idempotent: true } },
        { status: 200 },
      ),
    );

    const res = await POST(
      makeRequest({
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "sig_1",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );

    const forwardedReq = mockVerifyOrderPayment.mock.calls[0][0] as Request;
    const forwardedBody = await forwardedReq.json();
    const data = await res.json();

    expect(forwardedReq.method).toBe("PUT");
    expect(forwardedBody).toEqual({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig_1",
    });
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      idempotent: true,
      message: "Payment verified",
    });
  });

  it("passes through upstream error responses", async () => {
    mockVerifyOrderPayment.mockResolvedValue(
      Response.json({ error: "Invalid signature" }, { status: 400 }),
    );

    const res = await POST(
      makeRequest({
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_bad",
        razorpay_signature: "sig_bad",
      }),
      { params: Promise.resolve({ id: ORDER_ID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid signature");
  });
});
