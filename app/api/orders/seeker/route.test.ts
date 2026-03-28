import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockRequireSeeker } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireSeeker: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireSeeker: mockRequireSeeker,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "./route";

function buildDbMock(options: {
  seeker: Record<string, unknown> | null;
  orders?: Record<string, unknown>[];
  provider?: Record<string, unknown> | null;
}) {
  const seekerFindOne = vi.fn().mockResolvedValue(options.seeker);
  // Simulate $lookup: embed provider data into each order
  const enrichedOrders = (options.orders ?? []).map((order) => ({
    ...order,
    provider: options.provider ?? null,
  }));
  const toArray = vi.fn().mockResolvedValue(enrichedOrders);
  const aggregate = vi.fn().mockReturnValue({ toArray });

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "seekers") return { findOne: seekerFindOne };
      if (name === "orders") return { aggregate };
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, seekerFindOne, aggregate, toArray };
}

describe("GET /api/orders/seeker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns compatibility unauthorized payload for invalid seeker id", async () => {
    mockRequireSeeker.mockResolvedValue({ user: { id: "invalid-id" } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(body.error.message).toBe("Unauthorized");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns compatibility not-found payload when seeker record is missing", async () => {
    const seekerId = new ObjectId().toString();
    mockRequireSeeker.mockResolvedValue({ user: { id: seekerId } });
    const dbMock = buildDbMock({ seeker: null });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("Seeker not found");
    expect(body.error.message).toBe("Seeker not found");
  });

  it("returns enriched seeker orders", async () => {
    const seekerId = new ObjectId();
    const providerId = new ObjectId();
    const orderId = new ObjectId();

    mockRequireSeeker.mockResolvedValue({ user: { id: seekerId.toString() } });
    const dbMock = buildDbMock({
      seeker: { _id: seekerId, name: "Naseeb" },
      orders: [{ _id: orderId, seeker_id: seekerId, provider_id: providerId }],
      provider: { _id: providerId, name: "Ash Laundry" },
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].provider?.name).toBe("Ash Laundry");
    expect(dbMock.aggregate).toHaveBeenCalled();
  });

  it("adds provider availability and strips raw leave periods from seeker orders", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-15T06:00:00+05:30"));

    try {
      const seekerId = new ObjectId();
      const providerId = new ObjectId();
      const orderId = new ObjectId();

      mockRequireSeeker.mockResolvedValue({ user: { id: seekerId.toString() } });
      const dbMock = buildDbMock({
        seeker: { _id: seekerId, name: "Naseeb" },
        orders: [{ _id: orderId, seeker_id: seekerId, provider_id: providerId }],
        provider: {
          _id: providerId,
          name: "Ash Laundry",
          leavePeriods: [
            {
              _id: "leave-1",
              startDate: "2030-06-15",
              endDate: "2030-06-16",
              createdAt: "2030-06-01T00:00:00.000Z",
            },
          ],
        },
      });
      mockGetDb.mockResolvedValue({ db: dbMock.db });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data[0].provider.availability).toEqual({
        isCurrentlyOnLeave: true,
        activeLeaveEndDate: "2030-06-16",
        isUnavailableForRequestedDeadline: false,
        nextAvailableDate: "2030-06-17",
      });
      expect(body.data[0].provider.leavePeriods).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
