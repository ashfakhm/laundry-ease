import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetBookingById,
  mockGetDb,
  mockRequireSeeker,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetBookingById: vi.fn(),
  mockGetDb: vi.fn(),
  mockRequireSeeker: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
  getBookingById: mockGetBookingById,
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

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { DELETE } from "./route";

describe("DELETE /api/bookings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockRequireSeeker.mockResolvedValue({
      user: { id: new ObjectId().toString() },
    });
  });

  it("returns compatibility error payload for invalid id", async () => {
    const req = new Request("https://laundryease.test/api/bookings/bad-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Invalid booking id");
    expect(body.error.message).toBe("Invalid booking id");
    expect(mockGetBookingById).not.toHaveBeenCalled();
  });

  it("returns compatibility success payload when booking is deleted", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();

    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString() },
    });
    mockGetBookingById.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      status: "cancelled",
    });

    const ordersFindOne = vi.fn().mockResolvedValue(null);
    const bookingsDeleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
    mockGetDb.mockResolvedValue({
      db: {
        collection: vi.fn((name: string) => {
          if (name === "orders") return { findOne: ordersFindOne };
          if (name === "bookings") return { deleteOne: bookingsDeleteOne };
          throw new Error(`Unexpected collection: ${name}`);
        }),
      },
    });

    const req = new Request(
      `https://laundryease.test/api/bookings/${bookingId.toString()}`,
      {
        method: "DELETE",
      },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.data.message).toBe("Booking deleted successfully");
  });

  it("returns compatibility error payload when booking has associated order", async () => {
    const bookingId = new ObjectId();
    const seekerId = new ObjectId();

    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString() },
    });
    mockGetBookingById.mockResolvedValue({
      _id: bookingId,
      seeker_id: seekerId,
      status: "cancelled",
    });

    mockGetDb.mockResolvedValue({
      db: {
        collection: vi.fn((name: string) => {
          if (name === "orders") {
            return { findOne: vi.fn().mockResolvedValue({ _id: new ObjectId() }) };
          }
          if (name === "bookings") {
            return { deleteOne: vi.fn() };
          }
          throw new Error(`Unexpected collection: ${name}`);
        }),
      },
    });

    const req = new Request(
      `https://laundryease.test/api/bookings/${bookingId.toString()}`,
      {
        method: "DELETE",
      },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: bookingId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toContain("Cannot delete booking");
    expect(body.error.message).toContain("Cannot delete booking");
  });
});
