import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockRequireProvider,
  mockRequireSameOrigin,
  mockGetDb,
  mockDeleteProviderLeavePeriod,
  mockGetProviderLeavePeriods,
} = vi.hoisted(() => ({
  mockRequireProvider: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockGetDb: vi.fn(),
  mockDeleteProviderLeavePeriod: vi.fn(),
  mockGetProviderLeavePeriods: vi.fn(),
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
  deleteProviderLeavePeriod: mockDeleteProviderLeavePeriod,
  getProviderLeavePeriods: mockGetProviderLeavePeriods,
}));

import { DELETE } from "./route";

describe("provider availability delete route", () => {
  const providerId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProvider.mockResolvedValue({
      user: { id: providerId.toString() },
    });
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockGetDb.mockResolvedValue({ db: {} });
  });

  it("returns 400 for invalid leave ids", async () => {
    const res = await DELETE(
      new Request("https://laundryease.test/api/provider/availability/bad-id", {
        method: "DELETE",
        headers: { origin: "https://laundryease.test" },
      }),
      {
        params: Promise.resolve({ id: "bad-id" }),
      },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Invalid leave id");
  });

  it("deletes leave periods and returns updated availability", async () => {
    mockDeleteProviderLeavePeriod.mockResolvedValue(true);
    mockGetProviderLeavePeriods.mockResolvedValue([]);

    const leaveId = new ObjectId().toString();
    const res = await DELETE(
      new Request(
        `https://laundryease.test/api/provider/availability/${leaveId}`,
        {
          method: "DELETE",
          headers: { origin: "https://laundryease.test" },
        },
      ),
      {
        params: Promise.resolve({ id: leaveId }),
      },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      deleted: true,
      leavePeriods: [],
      availability: {
        isCurrentlyOnLeave: false,
        isUnavailableForRequestedDeadline: false,
      },
    });
  });
});
