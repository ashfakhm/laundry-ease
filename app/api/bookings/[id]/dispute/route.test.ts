import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetDb,
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

describe("POST /api/bookings/[id]/dispute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  it("returns compatibility invalid-id payload", async () => {
    const req = new Request("https://laundryease.test/api/bookings/bad/dispute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://laundryease.test",
      },
      body: JSON.stringify({
        reason: "Delay",
        details: "Pickup was delayed badly",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "bad-id" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid booking id");
    expect(body.error.message).toBe("Invalid booking id");
  });

  it("creates dispute and returns compatibility success payload", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();
    const insertOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const findOne = vi.fn().mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      provider_id: new ObjectId(),
    });
    const db = {
      collection: vi.fn((name: string) => {
        if (name === "bookings") return { findOne };
        if (name === "disputes") return { insertOne };
        throw new Error(`Unexpected collection: ${name}`);
      }),
    };
    mockGetDb.mockResolvedValue({ db });
    mockRequireAuth.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });

    const req = new Request(
      `https://laundryease.test/api/bookings/${bookingId.toString()}/dispute`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://laundryease.test",
        },
        body: JSON.stringify({
          reason: "Late delivery",
          details: "The order arrived much later than promised.",
        }),
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ok).toBe(true);
    expect(insertOne).toHaveBeenCalledOnce();
  });
});
