import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock dependencies
const { mockGetDb, mockEnv, mockRazorpay, mockCronTracking } = vi.hoisted(
  () => ({
    mockGetDb: vi.fn(),
    mockEnv: { CRON_SECRET: "test-secret" },
    mockRazorpay: {
      orders: {
        fetch: vi.fn(),
        fetchPayments: vi.fn(),
      },
    },
    mockCronTracking: {
      startCronRun: vi.fn(),
      completeCronRun: vi.fn(),
    },
  }),
);

vi.mock("@/lib/mongodb", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/razorpay", () => ({ razorpay: mockRazorpay }));
vi.mock("@/lib/cron-tracking", () => mockCronTracking);
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockClient = {
  startSession: vi.fn(() => ({
    withTransaction: vi.fn(async (callback) => await callback({})),
    endSession: vi.fn(),
  })),
};

describe("GET /api/cron/reconciliation", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    dbMock = {
      collection: vi.fn((name) => {
        if (name === "orders") return dbMock.orders;
        if (name === "bookings") return dbMock.bookings;
        throw new Error(`Unexpected collection: ${name}`);
      }),
      orders: {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn(),
        updateOne: vi.fn(),
      },
      bookings: {
        updateOne: vi.fn(),
      },
    };

    mockGetDb.mockResolvedValue({ db: dbMock, client: mockClient });
    mockCronTracking.startCronRun.mockResolvedValue({ insertedId: "run_123" });
  });

  function makeRequest(auth = "Bearer test-secret") {
    return new NextRequest("http://localhost/api/cron/reconciliation", {
      headers: { Authorization: auth },
    });
  }

  it("returns 401 if unauthorized", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(mockCronTracking.startCronRun).not.toHaveBeenCalled();
  });

  it("skips orders if none found", async () => {
    dbMock.orders.toArray.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.data.totalUnpaidChecked).toBe(0);
    expect(data.data.correctedCount).toBe(0);
    expect(mockCronTracking.completeCronRun).toHaveBeenCalledWith(
      "run_123",
      "success",
      expect.anything(),
    );
  });

  it("corrects an order if Razorpay says paid", async () => {
    const mockOrder = {
      _id: "order_local_1",
      razorpay_order_id: "order_rzp_1",
      amount: 1000,
      payment_status: "unpaid",
    };

    dbMock.orders.toArray.mockResolvedValue([mockOrder]);

    // Mock Razorpay fetch order
    mockRazorpay.orders.fetch.mockResolvedValue({
      id: "order_rzp_1",
      status: "paid",
      amount: 1000,
      amount_paid: 1000,
    });

    // Mock Razorpay fetch payments
    mockRazorpay.orders.fetchPayments.mockResolvedValue({
      items: [
        { id: "pay_failed_1", status: "failed" },
        { id: "pay_success_1", status: "captured" },
      ],
    });

    dbMock.orders.updateOne.mockResolvedValue({ modifiedCount: 1 });
    dbMock.bookings.updateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.data.correctedCount).toBe(1);
    expect(data.data.correctedIds).toContain("order_local_1");

    // Verify DB updates
    expect(dbMock.orders.updateOne).toHaveBeenCalledWith(
      { _id: "order_local_1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          payment_status: "paid",
          razorpay_payment_id: "pay_success_1",
          reconciliation_method: "cron",
        }),
      }),
      expect.objectContaining({ session: expect.anything() }),
    );

    expect(dbMock.bookings.updateOne).toHaveBeenCalledWith(
      { razorpay_order_id: "order_rzp_1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          bookingFeeStatus: "paid",
          razorpay_payment_id: "pay_success_1",
        }),
      }),
      expect.objectContaining({ session: expect.anything() }),
    );
  });

  it("does not correct if Razorpay says attempted/created", async () => {
    const mockOrder = {
      _id: "order_local_2",
      razorpay_order_id: "order_rzp_2",
      amount: 1000,
      payment_status: "unpaid",
    };

    dbMock.orders.toArray.mockResolvedValue([mockOrder]);

    mockRazorpay.orders.fetch.mockResolvedValue({
      id: "order_rzp_2",
      status: "attempted",
      amount: 1000,
      amount_paid: 0,
    });

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.data.correctedCount).toBe(0);
    expect(dbMock.orders.updateOne).not.toHaveBeenCalled();
  });

  it("handles errors gracefully", async () => {
    const mockOrder = {
      _id: "order_error",
      razorpay_order_id: "order_rzp_error",
    };
    dbMock.orders.toArray.mockResolvedValue([mockOrder]);

    mockRazorpay.orders.fetch.mockRejectedValue(new Error("Network error"));

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.data.errors).toBe(1);
    // Job still succeeds overall, just reports error counts
    expect(mockCronTracking.completeCronRun).toHaveBeenCalledWith(
      "run_123",
      "success",
      expect.anything(),
    );
  });
});
