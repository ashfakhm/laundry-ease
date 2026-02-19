import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

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
  const providerId = new ObjectId();
  const bookingId = new ObjectId();

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
        id: providerId.toString(),
        role: Role.PROVIDER,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication and authorization", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireProvider.mockRejectedValue(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(401);
      expect(mockMarkProviderArrival).not.toHaveBeenCalled();
    });

    it("returns 401 when user ID is invalid", async () => {
      mockRequireProvider.mockResolvedValue({
        user: {
          id: "invalid-id",
          role: Role.PROVIDER,
        },
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("returns 400 for invalid booking id", async () => {
      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: "bad-id" }),
      });

      expect(res.status).toBe(400);
      expect(mockMarkProviderArrival).not.toHaveBeenCalled();
    });
  });

  describe("successful arrival marking", () => {
    it("delegates to markProviderArrival with coordinates and returns service response", async () => {
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

    it("handles request without coordinates", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 200,
        body: { success: true, idempotent: false },
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: bookingId.toString() }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockMarkProviderArrival).toHaveBeenCalledWith({
        bookingId: expect.any(ObjectId),
        providerId: expect.any(ObjectId),
        coordinates: null,
      });
    });

    it("handles NaN coordinates as null", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const res = await POST(
        makeRequest({ lat: "invalid", lng: "invalid" }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );

      expect(res.status).toBe(200);
      expect(mockMarkProviderArrival).toHaveBeenCalledWith({
        bookingId: expect.any(ObjectId),
        providerId: expect.any(ObjectId),
        coordinates: null,
      });
    });

    it("returns idempotent response when already arrived", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 200,
        body: { success: true, idempotent: true, message: "Already marked as arrived" },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.idempotent).toBe(true);
    });
  });

  describe("provider not assigned", () => {
    it("returns 403 when provider is not assigned to booking", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 403,
        body: { error: "Unauthorized" },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("booking state validation", () => {
    it("returns 404 when booking not found", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 404,
        body: { error: "Booking not found" },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: new ObjectId().toString() }),
        },
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Booking not found");
    });

    it("returns 400 when booking is not confirmed", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 400,
        body: { error: "Can only mark arrived for confirmed bookings" },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Can only mark arrived for confirmed bookings");
    });

    it("returns 400 when booking fee is not paid", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 400,
        body: { error: "Booking fee must be paid before marking arrival" },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Booking fee must be paid before marking arrival");
    });
  });

  describe("distance validation", () => {
    it("returns 400 when coordinates are required but missing", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 400,
        body: { error: "Current location coordinates are required." },
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Current location coordinates are required.");
    });

    it("returns 400 when provider is too far from location", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 400,
        body: {
          error: "Too far from location",
          distanceMeters: 500,
          allowedMeters: 200,
        },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Too far from location");
      expect(data.distanceMeters).toBe(500);
      expect(data.allowedMeters).toBe(200);
    });
  });

  describe("payout handling", () => {
    it("returns payout information on success", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 200,
        body: {
          success: true,
          payoutInitiated: true,
          payoutId: "payout_123",
          payoutStatus: "processing",
          message: "Marked arrived and booking-fee payout initiated",
        },
      });

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.payoutInitiated).toBe(true);
      expect(data.payoutId).toBe("payout_123");
      expect(data.payoutStatus).toBe("processing");
    });

    it("handles payout failure gracefully", async () => {
      mockMarkProviderArrival.mockResolvedValue({
        status: 200,
        body: {
          success: true,
          payoutInitiated: false,
          payoutStatus: "failed",
          payoutError: "Provider payout account is not configured",
          message: "Marked arrived successfully",
        },
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
      expect(data.payoutError).toBe("Provider payout account is not configured");
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error", async () => {
      mockMarkProviderArrival.mockRejectedValue(new Error("Unexpected error"));

      const res = await POST(
        makeRequest({ lat: 12.345, lng: 76.543 }),
        {
          params: Promise.resolve({ id: bookingId.toString() }),
        },
      );

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toBe("Internal Server Error");
    });

    it("handles AppError correctly", async () => {
      mockRequireProvider.mockRejectedValue(
        new AppError(ErrorCode.RATE_LIMITED, 429, "Too many requests"),
      );

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(429);
    });
  });
});
