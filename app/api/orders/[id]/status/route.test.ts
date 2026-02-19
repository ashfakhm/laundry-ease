import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetOrderById,
  mockGetDb,
  mockRequireProvider,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockEnqueueEmailOutboxJob,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetOrderById: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireProvider: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockEnqueueEmailOutboxJob: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  getOrderById: mockGetOrderById,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/email-outbox", () => ({
  enqueueEmailOutboxJob: mockEnqueueEmailOutboxJob,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

describe("POST /api/orders/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockRequireProvider.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: "provider",
      },
    });
  });

  it("returns compatibility invalid order id payload", async () => {
    const req = new Request("https://laundryease.test/api/orders/bad/status", {
      method: "POST",
      body: JSON.stringify({ status: "washing" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid order id");
    expect(body.error).toBe("Invalid order id");
  });

  it("returns compatibility not found payload when order missing", async () => {
    const orderId = new ObjectId().toString();
    mockGetOrderById.mockResolvedValue(null);

    const req = new Request(
      `https://laundryease.test/api/orders/${orderId}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status: "washing" }),
        headers: { "content-type": "application/json" },
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: orderId }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("Order not found");
    expect(body.error).toBe("Order not found");
  });

  it("returns compatibility success payload for valid transition", async () => {
    const providerId = new ObjectId();
    const seekerId = new ObjectId();
    const orderId = new ObjectId();

    mockRequireProvider.mockResolvedValue({
      user: {
        id: providerId.toString(),
        role: "provider",
      },
    });
    mockGetOrderById.mockResolvedValue({
      _id: orderId,
      provider_id: providerId,
      seeker_id: seekerId,
      payment_status: "paid",
      process_status: "processing",
    });

    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({
      db: {
        collection: vi.fn((name: string) => {
          if (name === "orders") return { updateOne };
          if (name === "seekers") return { findOne: vi.fn().mockResolvedValue(null) };
          throw new Error(`Unexpected collection ${name}`);
        }),
      },
    });

    const req = new Request(
      `https://laundryease.test/api/orders/${orderId.toString()}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status: "washing" }),
        headers: { "content-type": "application/json" },
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: orderId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.message).toBe("Status updated successfully");
    expect(updateOne).toHaveBeenCalledOnce();
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/seeker/orders/${orderId.toString()}`,
    );
  });
});
