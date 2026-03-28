import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockRequireProvider } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireProvider: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
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

describe("GET /api/provider/dashboard-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns compatibility unauthorized payload for invalid provider id", async () => {
    mockRequireProvider.mockResolvedValue({ user: { id: "invalid-id" } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(body.error.message).toBe("Unauthorized");
  });

  it("returns calculated dashboard stats", async () => {
    const providerId = new ObjectId();
    mockRequireProvider.mockResolvedValue({ user: { id: providerId.toString() } });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-15T06:00:00+05:30"));

    try {
      const providerFindOne = vi.fn().mockResolvedValue({
        _id: providerId,
        leavePeriods: [
          {
            _id: "leave-1",
            startDate: "2030-06-15",
            endDate: "2030-06-17",
            createdAt: "2030-06-01T00:00:00.000Z",
          },
        ],
      });
      const revenueToArray = vi.fn().mockResolvedValue([{ totalRevenue: 768 }]);
      const ordersAggregate = vi.fn().mockReturnValue({ toArray: revenueToArray });
      const ordersCountDocuments = vi.fn().mockResolvedValue(4);
      const bookingsCountDocuments = vi.fn().mockResolvedValue(3);

      const db = {
        collection: vi.fn((name: string) => {
          if (name === "providers") {
            return {
              findOne: providerFindOne,
            };
          }
          if (name === "orders") {
            return {
              aggregate: ordersAggregate,
              countDocuments: ordersCountDocuments,
            };
          }
          if (name === "bookings") {
            return {
              countDocuments: bookingsCountDocuments,
            };
          }
          throw new Error(`Unexpected collection: ${name}`);
        }),
      };

      mockGetDb.mockResolvedValue({ db });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual({
        revenue: 768,
        deliveriesDue: 4,
        pendingPickups: 3,
        activeProcessing: 4,
        isCurrentlyOnLeave: true,
        activeLeaveEndDate: "2030-06-17",
      });
      expect(providerFindOne).toHaveBeenCalledOnce();
      expect(ordersAggregate).toHaveBeenCalledOnce();
      expect(bookingsCountDocuments).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
