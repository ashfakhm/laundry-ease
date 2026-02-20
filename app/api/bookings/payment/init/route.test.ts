import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { POST as createBookingFeeOrder } from "../../[id]/pay/route";
import { NextRequest, NextResponse } from "next/server";

// Mock env before imports to prevent Zod validation error
vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "test-secret",
    CRON_SECRET: "test-cron-secret",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_123",
  },
}));

// Mock the delegated route
vi.mock("../../[id]/pay/route", () => ({
  POST: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new NextRequest("https://laundryease.test/api/bookings/payment/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings/payment/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if bookingId is missing", async () => {
    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe("Invalid booking ID");
  });

  it("should return success response with Razorpay details on success", async () => {
    // Mock successful response from delegate
    const mockOrderData = {
      id: "order_123",
      amount: 5000,
      currency: "INR",
    };

    vi.mocked(createBookingFeeOrder).mockResolvedValue(
      NextResponse.json({
        success: true,
        data: mockOrderData,
      }),
    );

    const res = await POST(
      makeRequest({ bookingId: "507f1f77bcf86cd799439011" }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Check transformed data
    expect(json.data.orderId).toBe("order_123");
    expect(json.data.amount).toBe(5000);
    expect(json.data.currency).toBe("INR");
    expect(json.data.keyId).toBe("rzp_test_123");

    // Verify delegate was called correctly
    expect(createBookingFeeOrder).toHaveBeenCalled();
  });

  it("should pass through error response from delegate", async () => {
    // Mock error response from delegate
    vi.mocked(createBookingFeeOrder).mockResolvedValue(
      NextResponse.json(
        {
          success: false,
          message: "Booking not found",
          error: { code: "BOOKING_NOT_FOUND", message: "Booking not found" },
        },
        { status: 404 },
      ),
    );

    const res = await POST(
      makeRequest({ bookingId: "507f1f77bcf86cd799439011" }),
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.message).toBe("Booking not found");
  });
});
