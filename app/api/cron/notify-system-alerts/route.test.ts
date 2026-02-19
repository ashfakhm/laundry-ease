import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockGetDb,
  mockStartCronRun,
  mockCompleteCronRun,
  mockBuildOwnerRoutingDecisions,
  mockBuildAlertDeliveryPlan,
  mockDeliverAlertDigest,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockStartCronRun: vi.fn(),
  mockCompleteCronRun: vi.fn(),
  mockBuildOwnerRoutingDecisions: vi.fn(),
  mockBuildAlertDeliveryPlan: vi.fn(),
  mockDeliverAlertDigest: vi.fn(),
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

vi.mock("@/lib/ops/owner-routing", () => ({
  buildOwnerRoutingDecisions: mockBuildOwnerRoutingDecisions,
}));

vi.mock("@/lib/ops/alert-delivery", () => ({
  buildAlertDeliveryPlan: mockBuildAlertDeliveryPlan,
}));

vi.mock("@/lib/ops/alert-channels", () => ({
  deliverAlertDigest: mockDeliverAlertDigest,
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
  const alertsToArray = vi.fn();
  const systemAlertsBulkWrite = vi.fn();
  const systemAlertsUpdateMany = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "system_alerts") {
        return {
          find: vi.fn(() => ({ toArray: alertsToArray })),
          bulkWrite: systemAlertsBulkWrite,
          updateMany: systemAlertsUpdateMany,
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return {
    db,
    alertsToArray,
    systemAlertsBulkWrite,
    systemAlertsUpdateMany,
  };
}

describe("GET /api/cron/notify-system-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockBuildOwnerRoutingDecisions.mockReturnValue([]);
    mockBuildAlertDeliveryPlan.mockReturnValue({
      notifyIds: [],
      escalateIds: [],
    });
    mockDeliverAlertDigest.mockResolvedValue({
      emailSent: true,
      webhookSent: true,
      skipped: false,
    });
  });

  it("returns 401 when token is missing", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/notify-system-alerts",
    );
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockStartCronRun).not.toHaveBeenCalled();
  });

  it("sends due notifications and records cron run when authorized", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });

    const alertId = new ObjectId();
    dbMock.alertsToArray.mockResolvedValue([
      {
        _id: alertId,
        key: "ops.overdue.held",
        message: "Held orders are overdue",
        severity: "high",
        status: "open",
        firstSeenAt: new Date("2026-02-19T10:00:00.000Z"),
        lastSeenAt: new Date("2026-02-19T10:05:00.000Z"),
        notification: {},
        ownership: {},
      },
    ]);
    mockBuildAlertDeliveryPlan.mockReturnValue({
      notifyIds: [alertId.toString()],
      escalateIds: [],
    });

    const req = new Request(
      "https://laundryease.test/api/cron/notify-system-alerts",
      {
        headers: { authorization: "Bearer test-cron-secret" },
      },
    );
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.openAlerts).toBe(1);
    expect(body.due.notify).toBe(1);
    expect(body.delivered.notify.skipped).toBe(false);

    expect(mockStartCronRun).toHaveBeenCalledWith("notify-system-alerts");
    expect(mockDeliverAlertDigest).toHaveBeenCalledTimes(1);
    expect(dbMock.systemAlertsBulkWrite).not.toHaveBeenCalled();
    expect(dbMock.systemAlertsUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "success",
      expect.objectContaining({ success: true }),
    );
  });
});
