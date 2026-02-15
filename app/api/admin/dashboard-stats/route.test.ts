import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const { mockGetServerSession, mockGetDb, mockLoggerError } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetDb: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET } from "./route";

function makeDbMock() {
  const systemAlertCountDocuments = vi.fn();
  const systemAlertFind = vi.fn();
  const systemAlertToArray = vi.fn();
  const complaintCountDocuments = vi.fn();
  const complaintFind = vi.fn();
  const complaintSort = vi.fn();
  const complaintLimit = vi.fn();
  const complaintToArray = vi.fn();

  const ordersAggregate = vi.fn();
  const ordersDistinct = vi.fn();
  const ordersCountDocuments = vi.fn();
  const heldEscrowToArray = vi.fn();
  const totalRevenueToArray = vi.fn();

  const providersCountDocuments = vi.fn();
  const providersFind = vi.fn();
  const providersToArray = vi.fn();

  const seekersFind = vi.fn();
  const seekersToArray = vi.fn();

  complaintFind.mockReturnValue({
    sort: complaintSort,
  });
  complaintSort.mockReturnValue({
    limit: complaintLimit,
  });
  complaintLimit.mockReturnValue({
    toArray: complaintToArray,
  });

  providersFind.mockReturnValue({
    toArray: providersToArray,
  });

  seekersFind.mockReturnValue({
    toArray: seekersToArray,
  });

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "complaints") {
        return {
          countDocuments: complaintCountDocuments,
          find: complaintFind,
        };
      }
      if (name === "system_alerts") {
        return {
          countDocuments: systemAlertCountDocuments,
          find: systemAlertFind,
        };
      }
      if (name === "orders") {
        return {
          aggregate: ordersAggregate,
          distinct: ordersDistinct,
          countDocuments: ordersCountDocuments,
        };
      }
      if (name === "providers") {
        return {
          countDocuments: providersCountDocuments,
          find: providersFind,
        };
      }
      if (name === "seekers") {
        return {
          find: seekersFind,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return {
    db,
    systemAlertCountDocuments,
    systemAlertFind,
    systemAlertToArray,
    complaintCountDocuments,
    complaintFind,
    complaintSort,
    complaintLimit,
    complaintToArray,
    ordersAggregate,
    ordersDistinct,
    ordersCountDocuments,
    heldEscrowToArray,
    totalRevenueToArray,
    providersCountDocuments,
    providersFind,
    providersToArray,
    seekersFind,
    seekersToArray,
  };
}

describe("GET /api/admin/dashboard-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns 401 when session user is not admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        role: Role.SEEKER,
        email: "seeker@test.com",
      },
    });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns computed live metrics for admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        role: Role.ADMIN,
        email: "admin@test.com",
      },
    });

    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const providerA = new ObjectId();
    const providerB = new ObjectId();
    const seekerA = new ObjectId();
    const seekerB = new ObjectId();

    dbMock.systemAlertCountDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    dbMock.systemAlertFind.mockReturnValue({
      toArray: dbMock.systemAlertToArray,
    });
    const now = Date.now();
    dbMock.systemAlertToArray.mockResolvedValue([
      {
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        createdAt: new Date(now - 26 * 60 * 60 * 1000),
        resolvedAt: new Date(now - 20 * 60 * 60 * 1000),
      },
      {
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
    ]);
    dbMock.complaintCountDocuments
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    dbMock.ordersAggregate
      .mockReturnValueOnce({ toArray: dbMock.heldEscrowToArray })
      .mockReturnValueOnce({ toArray: dbMock.totalRevenueToArray });
    dbMock.heldEscrowToArray.mockResolvedValue([{ totalEscrow: 768 }]);
    dbMock.totalRevenueToArray.mockResolvedValue([{ totalRevenue: 858 }]);
    dbMock.ordersDistinct.mockResolvedValue([providerA, providerB]);
    dbMock.providersCountDocuments.mockResolvedValue(4);
    dbMock.ordersCountDocuments.mockResolvedValue(8);
    dbMock.complaintToArray.mockResolvedValue([
      {
        _id: new ObjectId(),
        title: "Bad Service",
        status: "open",
        createdAt: new Date("2026-02-09T17:21:26.000Z"),
        seeker_id: seekerA,
        provider_id: providerA,
      },
      {
        _id: new ObjectId(),
        title: "",
        status: "in_review",
        createdAt: new Date("2026-02-02T13:50:07.000Z"),
        seeker_id: seekerB.toString(),
        provider_id: providerB.toString(),
      },
    ]);
    dbMock.seekersToArray.mockResolvedValue([
      { _id: seekerA, name: "Smoke Seeker" },
      { _id: seekerB, name: "Naseeb" },
    ]);
    dbMock.providersToArray.mockResolvedValue([
      {
        _id: providerA,
        name: "Smoke Provider",
        businessName: "Smoke Laundry Hub",
      },
      {
        _id: providerB,
        name: "Ash Laundry Services",
        businessName: null,
      },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.criticalSystemAlerts).toBe(1);
    expect(data.highSystemAlerts).toBe(2);
    expect(data.systemAlertCount).toBe(3);
    expect(data.operationalHealth).toEqual(
      expect.objectContaining({
        trend7d: expect.any(Array),
        burnRate: expect.any(Number),
        burnRateTier: expect.any(String),
        mttrHours7d: expect.any(Number),
      }),
    );
    expect(data.operationalHealth.trend7d).toHaveLength(7);
    expect(data.openComplaints).toBe(2);
    expect(data.activeComplaints).toBe(3);
    expect(data.escrowBalance).toBe(768);
    expect(data.activeProviders).toBe(2);
    expect(data.totalProviders).toBe(4);
    expect(data.providerUtilizationPct).toBe(50);
    expect(data.totalOrders).toBe(8);
    expect(data.totalRevenue).toBe(858);
    expect(data.recentActiveComplaints).toHaveLength(2);
    expect(data.recentActiveComplaints[0]).toEqual(
      expect.objectContaining({
        title: "Bad Service",
        status: "open",
        seekerName: "Smoke Seeker",
        providerName: "Smoke Laundry Hub",
      }),
    );
    expect(data.recentActiveComplaints[1]).toEqual(
      expect.objectContaining({
        title: null,
        status: "in_review",
        seekerName: "Naseeb",
        providerName: "Ash Laundry Services",
      }),
    );

    expect(dbMock.complaintCountDocuments).toHaveBeenNthCalledWith(1, {
      status: "open",
    });
    expect(dbMock.complaintCountDocuments).toHaveBeenNthCalledWith(2, {
      status: { $in: ["open", "accepted", "in_review"] },
    });
    expect(dbMock.ordersDistinct).toHaveBeenCalledWith("provider_id", {
      createdAt: { $gte: expect.any(Date) },
    });
    expect(dbMock.systemAlertCountDocuments).toHaveBeenNthCalledWith(1, {
      status: "open",
      severity: "critical",
    });
    expect(dbMock.systemAlertCountDocuments).toHaveBeenNthCalledWith(2, {
      status: "open",
      severity: "high",
    });
    expect(dbMock.systemAlertFind).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: { $in: ["critical", "high"] },
      }),
      expect.objectContaining({
        projection: expect.objectContaining({
          createdAt: 1,
          resolvedAt: 1,
        }),
      }),
    );
    expect(dbMock.complaintFind).toHaveBeenCalledWith(
      { status: { $in: ["open", "accepted", "in_review"] } },
      expect.objectContaining({
        projection: expect.objectContaining({
          title: 1,
          seeker_id: 1,
          provider_id: 1,
        }),
      }),
    );
    expect(dbMock.complaintSort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(dbMock.complaintLimit).toHaveBeenCalledWith(5);
  });

  it("returns 500 when db read fails", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        role: Role.ADMIN,
        email: "admin@test.com",
      },
    });
    mockGetDb.mockRejectedValue(new Error("db_unavailable"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Internal server error" });
    expect(mockLoggerError).toHaveBeenCalledWith(
      "ADMIN_DASHBOARD",
      "Error fetching admin dashboard stats",
      expect.any(Error),
    );
  });
});
