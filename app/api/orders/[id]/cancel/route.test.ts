import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetOrderById, mockCancelOrder, mockRequireSeeker } = vi.hoisted(
  () => ({
    mockGetOrderById: vi.fn(),
    mockCancelOrder: vi.fn(),
    mockRequireSeeker: vi.fn(),
  }),
);

vi.mock("@/lib/db/index", () => ({
  getOrderById: mockGetOrderById,
  cancelOrder: mockCancelOrder,
}));

vi.mock("@/lib/api/auth", () => ({ requireSeeker: mockRequireSeeker }));
vi.mock("@/lib/api/security", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requireSameOrigin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

const seekerId = new ObjectId();
const orderId = new ObjectId();

function makeReq() {
  return new Request(`https://laundryease.test/api/orders/${orderId}/cancel`, {
    method: "POST",
  });
}

describe("POST /api/orders/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });
    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      payment_status: "unpaid",
      cancellation_status: null,
    });
    mockCancelOrder.mockResolvedValue(true);
  });

  it("returns 400 for invalid order id", async () => {
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: "bad-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found", async () => {
    mockGetOrderById.mockResolvedValue(null);
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the order owner", async () => {
    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      seeker_id: new ObjectId(),
      payment_status: "unpaid",
    });
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when order has been paid", async () => {
    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      seeker_id: seekerId,
      payment_status: "paid",
      cancellation_status: null,
    });
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    expect(res.status).toBe(400);
  });

  it("cancels order successfully", async () => {
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCancelOrder).toHaveBeenCalled();
  });
});
