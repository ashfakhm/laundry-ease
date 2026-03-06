import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminWithDbCheck,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
  mockRunDemoCronJob,
} = vi.hoisted(() => ({
  mockRequireAdminWithDbCheck: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockRunDemoCronJob: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/demo/cron-dispatch", () => ({
  runDemoCronJob: mockRunDemoCronJob,
}));

vi.mock("@/lib/env", () => ({
  env: {
    DEMO_MODE: "1",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_BASE_URL: "",
    NEXT_PUBLIC_APP_URL: "",
    CRON_SECRET: "demo-cron-secret",
  },
}));

import { POST } from "./route";

describe("POST /api/admin/demo/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockRequireAdminWithDbCheck.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439011",
        role: "admin",
        email: "admin@laundryease.test",
      },
    });
  });

  it("returns 400 for unknown job", async () => {
    const res = await POST(
      new Request("https://laundryease.test/api/admin/demo/cron", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://laundryease.test",
        },
        body: JSON.stringify({ job: "unknown-job" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("wraps successful cron payload in the standard envelope", async () => {
    mockRunDemoCronJob.mockResolvedValue({
      ok: true,
      status: 200,
      durationMs: 123,
      payload: {
        success: true,
        data: { processed: 2 },
      },
    });

    const res = await POST(
      new Request("https://laundryease.test/api/admin/demo/cron", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://laundryease.test",
        },
        body: JSON.stringify({ job: "process-payouts" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      job: "process-payouts",
      durationMs: 123,
      payload: { processed: 2 },
    });
  });
});
