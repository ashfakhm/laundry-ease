import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { NextResponse, NextRequest } from "next/server";

// Mock the main route
const { mockCreateOrderPayment } = vi.hoisted(() => ({
  mockCreateOrderPayment: vi.fn(),
}));

vi.mock("../route", () => ({
  POST: mockCreateOrderPayment,
}));

function makeRequest() {
  return new NextRequest(
    "https://laundryease.test/api/orders/123/payment/init",
    {
      method: "POST",
    },
  );
}

describe("legacy order payment init route", () => {
  it("maps success response correctly", async () => {
    mockCreateOrderPayment.mockResolvedValue(
      NextResponse.json({
        success: true,
        ok: true,
        data: {
          id: "order_123",
          amount: 5000,
          currency: "INR",
          key: "rzp_test_123",
        },
      }),
    );

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "123" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Check legacy mapping
    expect(json.data.orderId).toBe("order_123");
    expect(json.data.amount).toBe(5000);
    expect(json.data.currency).toBe("INR");
    expect(json.data.keyId).toBe("rzp_test_123");
  });

  it("passes through error response", async () => {
    mockCreateOrderPayment.mockResolvedValue(
      NextResponse.json(
        { success: false, error: "Some error" },
        { status: 400 },
      ),
    );

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "123" }),
    });

    expect(res.status).toBe(400);
  });
});
