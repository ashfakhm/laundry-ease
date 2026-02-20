import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockCheckNoShows, mockStartCronRun, mockCompleteCronRun } = vi.hoisted(
  () => ({
    mockCheckNoShows: vi.fn(),
    mockStartCronRun: vi.fn(),
    mockCompleteCronRun: vi.fn(),
  }),
);

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test-cron-secret" },
}));

vi.mock("@/cron/no-show-check", () => ({
  checkNoShows: mockCheckNoShows,
}));

vi.mock("@/lib/cron-tracking", () => ({
  startCronRun: mockStartCronRun,
  completeCronRun: mockCompleteCronRun,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

describe("GET /api/cron/no-show", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockCheckNoShows.mockResolvedValue({ flagged: 1 });
  });

  it("returns 401 when token is missing", async () => {
    const req = new Request("https://laundryease.test/api/cron/no-show");
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const req = new Request("https://laundryease.test/api/cron/no-show", {
      headers: { authorization: "Bearer wrong" },
    });
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("runs no-show check when authorized", async () => {
    const req = new Request("https://laundryease.test/api/cron/no-show", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCheckNoShows).toHaveBeenCalled();
  });

  it("returns 500 on job failure", async () => {
    mockCheckNoShows.mockRejectedValue(new Error("DB fail"));
    const req = new Request("https://laundryease.test/api/cron/no-show", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req as never);
    expect(res.status).toBe(500);
  });
});
