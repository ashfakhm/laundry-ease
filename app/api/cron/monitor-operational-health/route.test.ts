import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetDb,
  mockStartCronRun,
  mockCompleteCronRun,
  mockDefaultOperationalThresholds,
  mockEvaluateOperationalSignals,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockStartCronRun: vi.fn(),
  mockCompleteCronRun: vi.fn(),
  mockDefaultOperationalThresholds: vi.fn(),
  mockEvaluateOperationalSignals: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
  },
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/cron-tracking", () => ({
  startCronRun: mockStartCronRun,
  completeCronRun: mockCompleteCronRun,
}));

vi.mock("@/lib/ops/health", () => ({
  defaultOperationalThresholds: mockDefaultOperationalThresholds,
  evaluateOperationalSignals: mockEvaluateOperationalSignals,
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

function makeDbMock() {
  const overdueOrdersToArray = vi.fn();
  const openAlertsToArray = vi.fn();
  const ordersCountDocuments = vi.fn();
  const complaintsCountDocuments = vi.fn();
  const systemAlertsBulkWrite = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "orders") {
        return {
          find: vi.fn(() => ({ toArray: overdueOrdersToArray })),
          countDocuments: ordersCountDocuments,
        };
      }
      if (name === "complaints") {
        return {
          countDocuments: complaintsCountDocuments,
        };
      }
      if (name === "system_alerts") {
        return {
          find: vi.fn(() => ({ toArray: openAlertsToArray })),
          bulkWrite: systemAlertsBulkWrite,
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return {
    db,
    overdueOrdersToArray,
    openAlertsToArray,
    ordersCountDocuments,
    complaintsCountDocuments,
    systemAlertsBulkWrite,
  };
}

describe("GET /api/cron/monitor-operational-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockDefaultOperationalThresholds.mockReturnValue({
      overdueHeldOrders: 3,
      payoutFailures: 2,
      overdueComplaints: 2,
    });
    mockEvaluateOperationalSignals.mockReturnValue([]);
  });

  it("returns 401 when authorization header is missing", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/monitor-operational-health",
    );
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockStartCronRun).not.toHaveBeenCalled();
  });

  it("returns success payload when authorized", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.overdueOrdersToArray.mockResolvedValue([]);
    dbMock.ordersCountDocuments.mockResolvedValue(0);
    dbMock.complaintsCountDocuments.mockResolvedValue(0);
    dbMock.openAlertsToArray.mockResolvedValue([]);

    const req = new Request(
      "https://laundryease.test/api/cron/monitor-operational-health",
      {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      },
    );
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.activeSignals).toEqual([]);
    expect(body.openedOrUpdated).toBe(0);
    expect(body.resolvedCount).toBe(0);
    expect(mockStartCronRun).toHaveBeenCalledWith("monitor-operational-health");
    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "success",
      expect.objectContaining({ success: true }),
    );
  });
});
