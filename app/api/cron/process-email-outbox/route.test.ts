import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockProcessEmailOutboxBatch,
  mockStartCronRun,
  mockCompleteCronRun,
} = vi.hoisted(() => ({
  mockProcessEmailOutboxBatch: vi.fn(),
  mockStartCronRun: vi.fn(),
  mockCompleteCronRun: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
  },
}));

vi.mock("@/lib/email-outbox", () => ({
  processEmailOutboxBatch: mockProcessEmailOutboxBatch,
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

describe("GET /api/cron/process-email-outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockProcessEmailOutboxBatch.mockResolvedValue({
      processed: 2,
      sent: 2,
      retried: 0,
      failed: 0,
      pendingReady: 0,
    });
    mockCompleteCronRun.mockResolvedValue(undefined);
  });

  it("returns 401 when cron token is missing", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/process-email-outbox",
    );
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockProcessEmailOutboxBatch).not.toHaveBeenCalled();
  });

  it("processes outbox when authorized", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/process-email-outbox?limit=75",
      {
        headers: { authorization: "Bearer test-cron-secret" },
      },
    );

    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.limit).toBe(75);
    expect(body.processed).toBe(2);
    expect(mockStartCronRun).toHaveBeenCalledWith("process-email-outbox");
    expect(mockProcessEmailOutboxBatch).toHaveBeenCalledWith({
      limit: 75,
      workerId: "cron:process-email-outbox",
    });
    expect(mockCompleteCronRun).toHaveBeenCalled();
  });
});
