import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockAuditIntegrity, mockStartCronRun, mockCompleteCronRun, mockGetDb } =
  vi.hoisted(() => ({
    mockAuditIntegrity: vi.fn(),
    mockStartCronRun: vi.fn(),
    mockCompleteCronRun: vi.fn(),
    mockGetDb: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test-cron-secret" },
}));

vi.mock("@/lib/audit/integrity", () => ({
  auditIntegrity: mockAuditIntegrity,
}));

vi.mock("@/lib/cron-tracking", () => ({
  startCronRun: mockStartCronRun,
  completeCronRun: mockCompleteCronRun,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

describe("GET /api/cron/audit-integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockAuditIntegrity.mockReturnValue([]);

    const mockToArray = vi.fn().mockResolvedValue([]);
    const mockFind = vi.fn().mockReturnValue({ toArray: mockToArray });
    const mockBulkWrite = vi.fn().mockResolvedValue({
      upsertedCount: 0,
      modifiedCount: 0,
    });
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          find: mockFind,
          bulkWrite: mockBulkWrite,
        }),
      },
    });
  });

  it("returns 401 when not authorized", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/audit-integrity",
    );
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("runs audit when authorized with no anomalies", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/audit-integrity",
      {
        headers: { authorization: "Bearer test-cron-secret" },
      },
    );
    const res = await GET(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.anomalies).toBe(0);
    expect(mockAuditIntegrity).toHaveBeenCalled();
    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "success",
      expect.objectContaining({ anomalies: 0 }),
    );
  });
});
