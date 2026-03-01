import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockCreateBooking,
  mockGetDb,
  mockRequireSeeker,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockCalculateDistance,
  mockGeocodeLocationText,
} = vi.hoisted(() => ({
  mockCreateBooking: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSeeker: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockCalculateDistance: vi.fn(),
  mockGeocodeLocationText: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  createBooking: mockCreateBooking,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/distance", () => ({
  calculateDistance: mockCalculateDistance,
}));

vi.mock("@/lib/geocoding", () => ({
  geocodeLocationText: mockGeocodeLocationText,
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

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/bookings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

function mockDb(providerDoc: Record<string, unknown>, seekerDoc: Record<string, unknown>) {
  const providersFindOne = vi.fn().mockResolvedValue(providerDoc);
  const seekersFindOne = vi.fn().mockResolvedValue(seekerDoc);

  mockGetDb.mockResolvedValue({
    db: {
      collection: vi.fn((name: string) => {
        if (name === "providers") return { findOne: providersFindOne };
        if (name === "seekers") return { findOne: seekersFindOne };
        throw new Error(`Unexpected collection ${name}`);
      }),
    },
  });
}

describe("POST /api/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockGeocodeLocationText.mockResolvedValue(null);
  });

  it("creates a booking using seeker profile coordinates when request omits coordinates", async () => {
    const seekerId = new ObjectId();
    const providerId = new ObjectId();
    const nowPlus3Hours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString() },
    });

    mockDb(
      {
        _id: providerId,
        coordinates: { lat: 12.9716, lng: 77.5946 },
        radius_km: 10,
        pricing: 149,
      },
      {
        _id: seekerId,
        coordinates: { lat: 12.9352, lng: 77.6245 },
        address: {
          line1: "100 Main St",
          city: "Bengaluru",
        },
      },
    );

    mockCalculateDistance.mockReturnValue(4.2);
    mockCreateBooking.mockResolvedValue({
      _id: new ObjectId(),
      status: "requested",
    });

    const res = await POST(
      makeRequest({
        provider_id: providerId.toString(),
        deadline: nowPlus3Hours,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockCreateBooking).toHaveBeenCalledOnce();

    const createBookingInput = mockCreateBooking.mock.calls[0]?.[0] as {
      provider_id: ObjectId;
      seeker_id: ObjectId;
      seeker_coordinates: { lat: number; lng: number };
      bookingFee: number;
      capacity: number;
    };

    expect(createBookingInput.provider_id.toString()).toBe(providerId.toString());
    expect(createBookingInput.seeker_id.toString()).toBe(seekerId.toString());
    expect(createBookingInput.seeker_coordinates).toEqual({
      lat: 12.9352,
      lng: 77.6245,
    });
    expect(createBookingInput.bookingFee).toBe(149);
    expect(createBookingInput.capacity).toBe(100);
  });

  it("returns 409 when seeker is outside provider service radius", async () => {
    const seekerId = new ObjectId();
    const providerId = new ObjectId();
    const nowPlus3Hours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString() },
    });

    mockDb(
      {
        _id: providerId,
        coordinates: { lat: 12.9716, lng: 77.5946 },
        radius_km: 10,
        pricing: 149,
      },
      {
        _id: seekerId,
        coordinates: { lat: 13.2, lng: 77.9 },
        address: {
          line1: "200 Main St",
          city: "Bengaluru",
        },
      },
    );

    mockCalculateDistance.mockReturnValue(12.8);

    const res = await POST(
      makeRequest({
        provider_id: providerId.toString(),
        deadline: nowPlus3Hours,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain("Provider serves within 10 km");
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });
});
