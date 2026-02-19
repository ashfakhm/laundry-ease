import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockRequireProvider,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockMarkProviderArrival,
} = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockMarkProviderArrival: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/bookings/mark-arrived", () => ({
  markProviderArrival: mockMarkProviderArrival,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

function makeRequest(body: unknown = {}) {
  return new Request("https://laundryease.test/api/bookings/id/arrive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings/[id]/arrive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 30,
      remaining: 29,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    mockRequireProvider.mockResolvedValue({
      user: {
        id: new ObjectId().toString(),
        role: Role.PROVIDER,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid booking id", async () => {
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "bad-id" }),
    });

    expect(res.status).toBe(400);
    expect(mockMarkProviderArrival).not.toHaveBeenCalled();
  });

  it("delegates to markProviderArrival with coordinates and returns service response", async () => {
    const providerId = new ObjectId();
    const bookingId = new ObjectId();

    mockRequireProvider.mockResolvedValue({
      user: {
        id: providerId.toString(),
        role: Role.PROVIDER,
      },
    });
    mockMarkProviderArrival.mockResolvedValue({
      status: 200,
      body: { success: true, payoutInitiated: true },
    });

    const res = await POST(
      makeRequest({ lat: 12.345, lng: 76.543 }),
      {
        params: Promise.resolve({ id: bookingId.toString() }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockMarkProviderArrival).toHaveBeenCalledWith({
      bookingId: expect.any(ObjectId),
      providerId: expect.any(ObjectId),
      coordinates: { lat: 12.345, lng: 76.543 },
    });
  });
});
