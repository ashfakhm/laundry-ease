import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockRequireSeeker } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireSeeker: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ getDb: mockGetDb }));
vi.mock("@/lib/api/auth", () => ({
  requireProvider: vi.fn(),
  requireSeeker: mockRequireSeeker,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getSeekerBookings } from "./bookings";

const seekerId = new ObjectId();

function buildDbMock() {
  const aggregate = vi.fn().mockReturnValue({
    toArray: vi.fn().mockResolvedValue([
      {
        _id: new ObjectId(),
        seeker_id: seekerId,
        provider_id: new ObjectId(),
        status: "requested",
        providerDetails: {
          _id: new ObjectId(),
          name: "CleanCo",
        },
        createdAt: new Date("2026-03-28T10:00:00.000Z"),
      },
    ]),
  });

  const seekerFindOne = vi.fn().mockResolvedValue({
    _id: seekerId,
    name: "Naseeb",
  });

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "bookings") {
        return { aggregate };
      }

      if (name === "seekers") {
        return { findOne: seekerFindOne };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, aggregate };
}

describe("getSeekerBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSeeker.mockResolvedValue({
      user: { id: seekerId.toString(), role: "seeker" },
    });
  });

  it("excludes cancelled and rejected bookings by default", async () => {
    const dbMock = buildDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const result = await getSeekerBookings();

    expect(result.success).toBe(true);
    expect(dbMock.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            seeker_id: seekerId,
            status: { $nin: ["cancelled", "rejected"] },
          }),
        }),
      ]),
    );
  });

  it("includes finalized bookings when requested", async () => {
    const dbMock = buildDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const result = await getSeekerBookings({ includeFinalized: true });

    expect(result.success).toBe(true);
    expect(dbMock.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: {
            seeker_id: seekerId,
          },
        }),
      ]),
    );
  });

  it("adds provider availability to seeker bookings without exposing raw leave periods", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-15T06:00:00+05:30"));

    try {
      const aggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: new ObjectId(),
            seeker_id: seekerId,
            provider_id: new ObjectId(),
            status: "requested",
            providerDetails: {
              _id: new ObjectId(),
              name: "CleanCo",
              leavePeriods: [
                {
                  _id: new ObjectId(),
                  startDate: "2030-06-15",
                  endDate: "2030-06-16",
                  createdAt: new Date("2030-06-01T00:00:00.000Z"),
                },
              ],
            },
            createdAt: new Date("2030-06-15T10:00:00.000Z"),
          },
        ]),
      });

      mockGetDb.mockResolvedValue({
        db: {
          collection: vi.fn((name: string) => {
            if (name === "bookings") {
              return { aggregate };
            }
            if (name === "seekers") {
              return {
                findOne: vi.fn().mockResolvedValue({
                  _id: seekerId,
                  name: "Naseeb",
                }),
              };
            }
            throw new Error(`Unexpected collection: ${name}`);
          }),
        },
      });

      const result = await getSeekerBookings();

      expect(result.success).toBe(true);
      expect(result.data?.[0]?.provider.availability).toEqual({
        isCurrentlyOnLeave: true,
        activeLeaveEndDate: "2030-06-16",
        isUnavailableForRequestedDeadline: false,
        nextAvailableDate: "2030-06-17",
      });
      expect(result.data?.[0]?.provider).not.toHaveProperty("leavePeriods");
    } finally {
      vi.useRealTimers();
    }
  });
});
