import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

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

describe("POST /api/bookings/[id]/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  it("returns compatibility invalid-id payload", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: new ObjectId().toString(), role: Role.PROVIDER },
    });

    const req = new Request("https://laundryease.test/api/bookings/bad/schedule", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://laundryease.test",
      },
      body: JSON.stringify({
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "bad-id" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid booking id");
    expect(body.error.message).toBe("Invalid booking id");
  });

  it("returns compatibility success payload for valid provider proposal", async () => {
    const bookingId = new ObjectId();
    const providerId = new ObjectId();
    mockRequireAuth.mockResolvedValue({
      user: { id: providerId.toString(), role: Role.PROVIDER },
    });

    const findOne = vi.fn().mockResolvedValue({
      _id: bookingId,
      provider_id: providerId,
      status: "accepted",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });
    const db = {
      collection: vi.fn(() => ({ findOne, updateOne })),
    };
    mockGetDb.mockResolvedValue({ db });

    const req = new Request(
      `https://laundryease.test/api/bookings/${bookingId.toString()}/schedule`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://laundryease.test",
        },
        body: JSON.stringify({
          action: "propose",
          dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
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
    expect(updateOne).toHaveBeenCalledOnce();
  });
});
