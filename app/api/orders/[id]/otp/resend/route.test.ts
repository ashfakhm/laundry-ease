import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetOrderById,
  mockRequireProvider,
  mockGetDb,
  mockEnqueueEmailOutboxJob,
} = vi.hoisted(() => ({
  mockGetOrderById: vi.fn(),
  mockRequireProvider: vi.fn(),
  mockGetDb: vi.fn(),
  mockEnqueueEmailOutboxJob: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  getOrderById: mockGetOrderById,
}));

vi.mock("@/lib/api/auth", () => ({ requireProvider: mockRequireProvider }));

vi.mock("@/lib/api/security", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requireSameOrigin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mongodb", () => ({ getDb: mockGetDb }));

vi.mock("@/lib/email-outbox", () => ({
  enqueueEmailOutboxJob: mockEnqueueEmailOutboxJob,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock crypto and bcrypt
vi.mock("crypto", () => ({
  randomInt: vi.fn().mockReturnValue(123456),
}));
vi.mock("bcrypt", () => ({
  hash: vi.fn().mockResolvedValue("$2b$10$hashed"),
}));

import { POST } from "./route";

const providerId = new ObjectId();
const seekerId = new ObjectId();
const orderId = new ObjectId();

function makeReq() {
  return new Request(
    `https://laundryease.test/api/orders/${orderId}/otp/resend`,
    { method: "POST" },
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
    process_status: "out_for_delivery",
    delivery_otp_sent_at: new Date(Date.now() - 120_000), // 2min ago
    delivery_otp_resend_count: 0,
    ...overrides,
  };
}

function setupDb(seekerEmail = "test@example.com") {
  const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  const seekerFindOne = vi
    .fn()
    .mockResolvedValue(seekerEmail ? { email: seekerEmail } : null);
  mockGetDb.mockResolvedValue({
    db: {
      collection: vi.fn((name: string) => {
        if (name === "orders") return { updateOne };
        if (name === "seekers") return { findOne: seekerFindOne };
        throw new Error(`Unexpected collection ${name}`);
      }),
    },
  });
  return { updateOne };
}

describe("POST /api/orders/[id]/otp/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProvider.mockResolvedValue({
      user: { id: providerId.toString(), role: "provider" },
    });
    mockGetOrderById.mockResolvedValue(makeOrder());
    mockEnqueueEmailOutboxJob.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid order id", async () => {
    const res = await POST(makeReq(), makeParams("bad-id"));
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

  it("returns 409 when order is not out_for_delivery", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ process_status: "washing" }),
    );
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(409);
  });

  it("returns 400 when seeker email not found", async () => {
    setupDb(null as unknown as string);
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 429 when resent too recently", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ delivery_otp_sent_at: new Date() }), // just now
    );
    setupDb();
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(429);
  });

  it("returns 429 when max resends reached", async () => {
    mockGetOrderById.mockResolvedValue(
      makeOrder({ delivery_otp_resend_count: 5 }),
    );
    setupDb();
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(429);
  });

  it("resends OTP successfully", async () => {
    const { updateOne } = setupDb();
    const res = await POST(makeReq(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe("OTP resent");
    expect(body.data.resendCount).toBe(1);
    expect(mockEnqueueEmailOutboxJob).toHaveBeenCalledOnce();
    expect(updateOne).toHaveBeenCalledOnce();
  });

  it("returns 502 when email fails to send", async () => {
    setupDb();
    mockEnqueueEmailOutboxJob.mockRejectedValueOnce(new Error("SMTP error"));
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(502);
  });
});
