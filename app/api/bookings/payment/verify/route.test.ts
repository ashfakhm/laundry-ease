import { afterEach, describe, expect, it, vi } from "vitest";

const { mockVerifyBookingFeePayment } = vi.hoisted(() => ({
  mockVerifyBookingFeePayment: vi.fn(),
}));

vi.mock("../../[id]/pay/route", () => ({
  PUT: mockVerifyBookingFeePayment,
}));

import { POST } from "./route";

const BOOKING_ID = "507f1f77bcf86cd799439072";

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/bookings/payment/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings/payment/verify (legacy alias)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when bookingId is missing", async () => {
    const res = await POST(
      makeRequest({
        razorpayOrderId: "order_1",
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Missing bookingId");
    expect(mockVerifyBookingFeePayment).not.toHaveBeenCalled();
  });

  it("normalizes payload and wraps upstream success", async () => {
    mockVerifyBookingFeePayment.mockResolvedValue(
      Response.json({ message: "Payment successful", idempotent: false }, { status: 200 }),
    );

    const res = await POST(
      makeRequest({
        bookingId: BOOKING_ID,
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "sig_1",
      }),
    );

    const forwardedReq = mockVerifyBookingFeePayment.mock.calls[0][0] as Request;
    const forwardedBody = await forwardedReq.json();
    const params = await mockVerifyBookingFeePayment.mock.calls[0][1].params;
    const data = await res.json();

    expect(forwardedReq.method).toBe("PUT");
    expect(forwardedBody).toEqual({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig_1",
    });
    expect(params).toEqual({ id: BOOKING_ID });
    expect(data).toEqual({
      success: true,
      message: "Payment successful",
      idempotent: false,
    });
  });
});

