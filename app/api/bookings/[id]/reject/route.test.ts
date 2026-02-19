import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetDb,
  mockGetBookingById,
  mockRequireProvider,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetBookingById: vi.fn(),
  mockRequireProvider: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db/index", () => ({
  getBookingById: mockGetBookingById,
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/bookings/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  it("returns compatibility unauthorized payload for invalid provider id", async () => {
    mockRequireProvider.mockResolvedValue({
      user: { id: "invalid-id" },
    });

    const req = new Request("https://laundryease.test/api/bookings/1/reject", {
      method: "PATCH",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: new ObjectId().toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(body.error).toBe("Unauthorized");
  });

  it("returns compatibility invalid booking id payload", async () => {
    const providerId = new ObjectId();
    mockRequireProvider.mockResolvedValue({
      user: { id: providerId.toString() },
    });
    mockGetDb.mockResolvedValue({
      db: {
        collection: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue({ _id: providerId }),
        })),
      },
    });

    const req = new Request("https://laundryease.test/api/bookings/bad/reject", {
      method: "PATCH",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid booking id");
    expect(body.error).toBe("Invalid booking id");
    expect(mockGetBookingById).not.toHaveBeenCalled();
  });
});
