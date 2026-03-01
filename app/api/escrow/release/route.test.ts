import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockProcessEligibleEscrowPayouts } = vi.hoisted(() => ({
  mockProcessEligibleEscrowPayouts: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test-secret" },
}));

vi.mock("@/lib/payouts", () => ({
  processEligibleEscrowPayouts: mockProcessEligibleEscrowPayouts,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function makeReq(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new Request("https://laundryease.test/api/escrow/release", {
    method: "POST",
    headers,
  });
}

describe("POST /api/escrow/release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessEligibleEscrowPayouts.mockResolvedValue({
      processed: 3,
      results: [{ bookingId: "b1", status: "released" }],
    });
  });

  it("returns 401 when authorization is missing", async () => {
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const res = await POST(makeReq("Bearer wrong-secret") as never);
    expect(res.status).toBe(401);
  });

  it("processes escrow payouts when authorized", async () => {
    const res = await POST(makeReq("Bearer test-secret") as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.processed).toBe(3);
    expect(mockProcessEligibleEscrowPayouts).toHaveBeenCalledWith({
      source: "escrow_release_endpoint",
    });
  });

  it("returns 500 when processing fails", async () => {
    mockProcessEligibleEscrowPayouts.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq("Bearer test-secret") as never);
    expect(res.status).toBe(500);
  });
});
