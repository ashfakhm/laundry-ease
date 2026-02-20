import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const { mockAutoRejectStaleBookings, mockStartCronRun, mockCompleteCronRun } =
  vi.hoisted(() => ({
    mockAutoRejectStaleBookings: vi.fn(),
    mockStartCronRun: vi.fn(),
    mockCompleteCronRun: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test-cron-secret" },
}));

vi.mock("@/cron/auto-reject-bookings", () => ({
  autoRejectStaleBookings: mockAutoRejectStaleBookings,
}));

vi.mock("@/lib/cron-tracking", () => ({
  startCronRun: mockStartCronRun,
  completeCronRun: mockCompleteCronRun,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

describe("GET /api/cron/auto-reject-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockAutoRejectStaleBookings.mockResolvedValue({ rejected: 2 });
  });

  it("returns 401 when token is missing", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/auto-reject-bookings",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it("processes auto-reject when authorized", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/auto-reject-bookings",
      {
        headers: { authorization: "Bearer test-cron-secret" },
      },
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockAutoRejectStaleBookings).toHaveBeenCalled();
  });
});
