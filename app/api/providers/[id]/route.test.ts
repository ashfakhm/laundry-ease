import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "./route";

function buildDbMock(provider: Record<string, unknown> | null) {
  const findOne = vi.fn().mockResolvedValue(provider);
  return {
    db: {
      collection: vi.fn(() => ({ findOne })),
    },
    findOne,
  };
}

describe("GET /api/providers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid provider id", async () => {
    const req = new NextRequest("https://laundryease.test/api/providers/bad-id");
    const res = await GET(req, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Invalid provider ID");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns 404 when provider is missing", async () => {
    const providerId = new ObjectId().toString();
    const dbMock = buildDbMock(null);
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const req = new NextRequest(`https://laundryease.test/api/providers/${providerId}`);
    const res = await GET(req, {
      params: Promise.resolve({ id: providerId }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.message).toBe("Provider not found");
    expect(dbMock.findOne).toHaveBeenCalledOnce();
  });

  it("returns provider details for valid id", async () => {
    const providerId = new ObjectId();
    const dbMock = buildDbMock({
      _id: providerId,
      name: "Ash Laundry",
      businessName: "Ash Laundry Services",
      leavePeriods: [
        {
          _id: "leave-1",
          startDate: "2030-06-15",
          endDate: "2030-06-16",
          createdAt: "2030-06-01T00:00:00.000Z",
        },
      ],
    });
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const req = new NextRequest(
      `https://laundryease.test/api/providers/${providerId.toString()}?deadline=2030-06-15T10:00`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: providerId.toString() }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Ash Laundry");
    expect(body.data.leavePeriods).toBeUndefined();
    expect(body.data.availability).toMatchObject({
      isCurrentlyOnLeave: false,
      isUnavailableForRequestedDeadline: true,
      nextAvailableDate: "2030-06-17",
    });
    expect(dbMock.findOne).toHaveBeenCalledWith(
      { _id: providerId, isDeleted: { $ne: true } },
      expect.objectContaining({
        projection: expect.objectContaining({
          bankDetails: 0,
          razorpay_fund_account_id: 0,
          emailVerified: 0,
          passwordHash: 0,
          phoneVerified: 0,
          razorpay_contact_id: 0,
        }),
      }),
    );
  });
});
