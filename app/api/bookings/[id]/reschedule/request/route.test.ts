import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";
import { AppError, ErrorCode } from "@/lib/api/errors";

const {
  mockRequireAuth,
  mockGetDb,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
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
  },
}));

import { POST } from "./route";

const BOOKING_ID = "507f1f77bcf86cd799439011";
const SEEKER_ID = "507f1f77bcf86cd799439012";
const PROVIDER_ID = "507f1f77bcf86cd799439013";

function makeDbMock() {
  const bookingFindOne = vi.fn();
  const bookingUpdateOne = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return {
          findOne: bookingFindOne,
          updateOne: bookingUpdateOne,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    bookingFindOne,
    bookingUpdateOne,
  };
}

function makeRequest(body: unknown = {}) {
  return new Request("https://laundryease.test/api/bookings/id/reschedule/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings/[id]/reschedule/request", () => {
  let dbMock: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      resetAt: new Date(),
      retryAfterSeconds: 60,
    });
    dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication and authorization", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockRequireAuth.mockRejectedValue(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 401 when user ID is invalid", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: "invalid-id",
          role: Role.SEEKER,
        },
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.message).toBe("Authentication required");
    });

    it("returns 403 when user is not the seeker or provider of the booking", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);
      const providerId = new ObjectId(PROVIDER_ID);
      const otherUserId = new ObjectId();

      mockRequireAuth.mockResolvedValue({
        user: {
          id: otherUserId.toString(),
          role: Role.SEEKER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        provider_id: providerId,
        status: "confirmed",
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.message).toBe("You are not allowed to reschedule this booking");
    });
  });

  describe("validation", () => {
    it("returns 400 for invalid booking ID", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: "invalid-id" }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toBe("Invalid booking id");
    });

    it("returns 400 for missing booking ID", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: "" }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toBe("Booking id is required");
    });

    it("returns 400 for invalid reason (too long)", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      const res = await POST(
        makeRequest({
          reason: "a".repeat(301), // Max is 300
        }),
        {
          params: Promise.resolve({ id: BOOKING_ID }),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toBe("Invalid request");
    });
  });

  describe("booking lookup", () => {
    it("returns 404 when booking not found", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      dbMock.bookingFindOne.mockResolvedValue(null);

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.message).toBe("Booking not found");
    });
  });

  describe("state validation", () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });
    });

    it("returns 422 when booking status is 'requested' (not allowed)", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "requested",
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.message).toContain("Reschedule is not allowed");
    });

    it("returns 422 when booking status is 'invoice_created'", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "invoice_created",
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.message).toContain("Reschedule is not allowed");
    });

    it("returns 422 when booking status is 'completed'", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "completed",
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.message).toContain("Reschedule is not allowed");
    });

    it("returns 422 when provider has already arrived", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "confirmed",
        arrivedAt: new Date(),
      });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.message).toContain("Reschedule is not allowed after provider has arrived");
    });
  });

  describe("successful reschedule request", () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });
    });

    it("successfully requests reschedule as seeker", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);
      const providerId = new ObjectId(PROVIDER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        provider_id: providerId,
        status: "confirmed",
        pickupSlot: {
          dateTime: new Date(),
          confirmedAt: new Date(),
        },
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const res = await POST(
        makeRequest({
          reason: "Need to change the pickup time",
        }),
        {
          params: Promise.resolve({ id: BOOKING_ID }),
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: bookingId,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "reschedule_requested",
            reschedule: expect.objectContaining({
              requestedBy: "seeker",
              reason: "Need to change the pickup time",
              count: 1,
            }),
          }),
        }),
      );
    });

    it("successfully requests reschedule as provider", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: PROVIDER_ID,
          role: Role.PROVIDER,
        },
      });

      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);
      const providerId = new ObjectId(PROVIDER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        provider_id: providerId,
        status: "accepted",
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const res = await POST(
        makeRequest({
          reason: "Schedule conflict",
        }),
        {
          params: Promise.resolve({ id: BOOKING_ID }),
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: bookingId,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "reschedule_requested",
            reschedule: expect.objectContaining({
              requestedBy: "provider",
              reason: "Schedule conflict",
            }),
          }),
        }),
      );
    });

    it("increments reschedule count if previously rescheduled", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);
      const providerId = new ObjectId(PROVIDER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        provider_id: providerId,
        status: "confirmed",
        reschedule: {
          count: 2,
        },
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(200);

      expect(dbMock.bookingUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: bookingId,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            reschedule: expect.objectContaining({
              count: 3,
            }),
          }),
        }),
      );
    });

    it("works without a reason (optional field)", async () => {
      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);
      const providerId = new ObjectId(PROVIDER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        provider_id: providerId,
        status: "pickup_proposed",
      });

      dbMock.bookingUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe("concurrency handling", () => {
    it("returns 422 when booking state changed during request", async () => {
      mockRequireAuth.mockResolvedValue({
        user: {
          id: SEEKER_ID,
          role: Role.SEEKER,
        },
      });

      const bookingId = new ObjectId(BOOKING_ID);
      const seekerId = new ObjectId(SEEKER_ID);

      dbMock.bookingFindOne.mockResolvedValue({
        _id: bookingId,
        seeker_id: seekerId,
        status: "confirmed",
      });

      // Simulate concurrent modification - no documents matched the query
      dbMock.bookingUpdateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.message).toBe("Booking was not in a reschedulable state");
    });
  });

  describe("error handling", () => {
    it("returns 500 on unexpected error", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unexpected error"));

      const res = await POST(makeRequest(), {
        params: Promise.resolve({ id: BOOKING_ID }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error.message).toBe("An unexpected error occurred");
    });
  });
});
