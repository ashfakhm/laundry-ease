import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";

const { mockGetDb, mockStartCronRun, mockCompleteCronRun } = vi.hoisted(
  () => ({
    mockGetDb: vi.fn(),
    mockStartCronRun: vi.fn(),
    mockCompleteCronRun: vi.fn(),
  }),
);

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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "./route";

function makeDbMock() {
  const deleteMany = vi.fn();

  const db = {
    collection: vi.fn((name: string) => {
      if (name === "webhook_events") {
        return { deleteMany };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, deleteMany };
}

describe("GET /api/cron/webhook-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
  });

  it("returns 401 when cron secret is missing", async () => {
    const req = new NextRequest(
      new URL("https://laundryease.test/api/cron/webhook-cleanup"),
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when cron secret is wrong", async () => {
    const req = new NextRequest(
      new URL("https://laundryease.test/api/cron/webhook-cleanup"),
      { headers: { authorization: "Bearer wrong-secret" } },
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("purges old processed webhook events", async () => {
    const dbMock = makeDbMock();
    mockGetDb.mockResolvedValue({ db: dbMock.db });
    dbMock.deleteMany.mockResolvedValue({ deletedCount: 5 });

    const req = new NextRequest(
      new URL("https://laundryease.test/api/cron/webhook-cleanup"),
      { headers: { authorization: "Bearer test-cron-secret" } },
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.purgedCount).toBe(5);

    expect(dbMock.deleteMany).toHaveBeenCalledWith({
      processed: true,
      received_at: { $lt: expect.any(Date) },
    });

    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "success",
      expect.objectContaining({ purgedCount: 5 }),
    );
  });

  it("records error on failure", async () => {
    mockGetDb.mockRejectedValue(new Error("DB down"));

    const req = new NextRequest(
      new URL("https://laundryease.test/api/cron/webhook-cleanup"),
      { headers: { authorization: "Bearer test-cron-secret" } },
    );

    const res = await GET(req);
    expect(res.status).toBe(500);

    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "error",
      undefined,
      expect.any(Error),
    );
  });
});
