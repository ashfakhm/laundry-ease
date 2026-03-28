import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockRequireProvider,
  mockRequireSameOrigin,
  mockGetDb,
  mockCreateProviderLeavePeriod,
  mockGetProviderLeavePeriods,
  mockFindLeaveConflictsForProvider,
} = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockGetDb: vi.fn(),
  mockCreateProviderLeavePeriod: vi.fn(),
  mockGetProviderLeavePeriods: vi.fn(),
  mockFindLeaveConflictsForProvider: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireProvider: mockRequireProvider,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db/provider-availability", () => ({
  createProviderLeavePeriod: mockCreateProviderLeavePeriod,
  getProviderLeavePeriods: mockGetProviderLeavePeriods,
}));

vi.mock("@/lib/services/provider-availability", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/provider-availability")
  >("@/lib/services/provider-availability");

  return {
    ...actual,
    findLeaveConflictsForProvider: mockFindLeaveConflictsForProvider,
  };
});

import { GET, POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("https://laundryease.test/api/provider/availability", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://laundryease.test",
    },
    body: JSON.stringify(body),
  });
}

describe("provider availability route", () => {
  const providerId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProvider.mockResolvedValue({
      user: { id: providerId.toString() },
    });
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockGetDb.mockResolvedValue({ db: {} });
  });

  it("returns leave periods and availability summary", async () => {
    mockGetProviderLeavePeriods.mockResolvedValue([
      {
        _id: "leave-2",
        startDate: "2030-06-20",
        endDate: "2030-06-21",
        createdAt: "2030-06-02T00:00:00.000Z",
      },
      {
        _id: "leave-1",
        startDate: "2030-06-10",
        endDate: "2030-06-12",
        createdAt: "2030-06-01T00:00:00.000Z",
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.leavePeriods.map((leave: { _id: string }) => leave._id)).toEqual([
      "leave-1",
      "leave-2",
    ]);
    expect(body.data.availability).toMatchObject({
      isCurrentlyOnLeave: false,
      isUnavailableForRequestedDeadline: false,
    });
  });

  it("creates a leave period and returns conflict summaries", async () => {
    const savedLeave = {
      _id: "leave-1",
      startDate: "2030-06-15",
      endDate: "2030-06-16",
      createdAt: "2030-06-01T00:00:00.000Z",
    };

    mockCreateProviderLeavePeriod.mockResolvedValue({
      created: true,
      overlapRejected: false,
      providerMissing: false,
    });
    mockGetProviderLeavePeriods.mockResolvedValue([savedLeave]);
    mockFindLeaveConflictsForProvider.mockResolvedValue({
      bookings: [
        {
          kind: "booking",
          id: "booking-1",
          status: "confirmed",
          href: "/provider/manage-booking",
          scheduledDate: "2030-06-15",
        },
      ],
      orders: [],
    });

    const res = await POST(
      makeRequest({
        startDate: "2030-06-15",
        endDate: "2030-06-16",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockCreateProviderLeavePeriod).toHaveBeenCalledOnce();
    expect(body.data.leavePeriod.startDate).toBe("2030-06-15");
    expect(body.data.conflicts.bookings).toHaveLength(1);
    expect(body.data.availability).toMatchObject({
      isCurrentlyOnLeave: false,
      isUnavailableForRequestedDeadline: false,
    });
  });

  it("rejects overlapping leave ranges with 409", async () => {
    mockCreateProviderLeavePeriod.mockResolvedValue({
      created: false,
      overlapRejected: true,
      providerMissing: false,
    });

    const res = await POST(
      makeRequest({
        startDate: "2030-06-15",
        endDate: "2030-06-16",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.message).toBe("Leave dates overlap an existing leave period");
  });
});
