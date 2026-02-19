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

describe("GET /api/cron/release-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartCronRun.mockResolvedValue({ insertedId: new ObjectId() });
    mockCompleteCronRun.mockResolvedValue(undefined);
    mockProcessEligibleEscrowPayouts.mockResolvedValue({
      processed: 1,
      results: [{ bookingId: "b2", status: "released" }],
    });
  });

  it("returns 401 when token is missing", async () => {
    const req = new Request("https://laundryease.test/api/cron/release-payouts");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockStartCronRun).not.toHaveBeenCalled();
  });

  it("releases payouts when authorized", async () => {
    const req = new Request("https://laundryease.test/api/cron/release-payouts", {
      headers: { authorization: "Bearer test-cron-secret" },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockStartCronRun).toHaveBeenCalledWith("release-payouts");
    expect(mockProcessEligibleEscrowPayouts).toHaveBeenCalledWith({
      source: "cron_release_payouts",
    });
    expect(mockCompleteCronRun).toHaveBeenCalledWith(
      expect.any(ObjectId),
      "success",
      expect.objectContaining({ processed: 1 }),
    );
  });
});
