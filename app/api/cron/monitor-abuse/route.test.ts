import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockGetDb, mockStartCronRun, mockCompleteCronRun } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockStartCronRun: vi.fn(),
  mockCompleteCronRun: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test-cron-secret" },
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/cron-tracking", () => ({
  startCronRun: mockStartCronRun,
  completeCronRun: mockCompleteCronRun,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

describe("GET /api/cron/monitor-abuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    const mockToArray = vi.fn().mockResolvedValue([]);
    const mockAggregate = vi.fn().mockReturnValue({ toArray: mockToArray });
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    mockGetDb.mockResolvedValue({
      db: {
        collection: () => ({
          aggregate: mockAggregate,
          findOne: mockFindOne,
          updateOne: mockUpdateOne,
        }),
      },
    });
  });

  it("returns 401 when token is missing", async () => {
    const req = new Request("https://laundryease.test/api/cron/monitor-abuse");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("runs abuse monitoring when authorized", async () => {
    const req = new Request("https://laundryease.test/api/cron/monitor-abuse", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.flaggedCount).toBe(0);
  });
});
