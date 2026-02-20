import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const {
  mockProcessEligibleEscrowPayouts,
  mockStartCronRun,
  mockCompleteCronRun,
} = vi.hoisted(() => ({
  mockProcessEligibleEscrowPayouts: vi.fn(),
  mockStartCronRun: vi.fn(),
  mockCompleteCronRun: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
  },
}));

vi.mock("@/lib/payouts", () => ({
  processEligibleEscrowPayouts: mockProcessEligibleEscrowPayouts,
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

describe("GET /api/cron/process-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockProcessEligibleEscrowPayouts.mockResolvedValue({
      processed: 2,
      results: [{ bookingId: "b1", status: "released" }],
    });
  });

  it("returns 401 when token is missing", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/process-payouts",
    );
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toEqual(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      }),
    );
    expect(mockStartCronRun).not.toHaveBeenCalled();
  });

  it("processes payouts when authorized", async () => {
    const req = new Request(
      "https://laundryease.test/api/cron/process-payouts",
      {
        headers: { authorization: "Bearer test-cron-secret" },
      },
    );

    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.processed).toBe(2);
    expect(mockStartCronRun).toHaveBeenCalledWith("process-payouts");
    expect(mockProcessEligibleEscrowPayouts).toHaveBeenCalledWith({
      source: "cron_process_payouts",
    });
    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "success",
      expect.objectContaining({ processed: 2 }),
    );
  });
});
