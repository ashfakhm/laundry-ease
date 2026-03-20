import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    E2E_FAKE_PAYMENTS: "1",
    RAZORPAYX_ACCOUNT_NUMBER: "acc_e2e_test",
  } as Record<string, string>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

describe("GET /api/e2e/runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockEnv.E2E_FAKE_PAYMENTS = "1";
    mockEnv.RAZORPAYX_ACCOUNT_NUMBER = "acc_e2e_test";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns a safe probe in development when fake payments are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      safeForSmokeReuse: true,
      e2eFakePayments: true,
      razorpayxConfigured: true,
      nodeEnv: "development",
    });
  });

  it("returns an unsafe probe in development when fake payments are disabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockEnv.E2E_FAKE_PAYMENTS = "0";
    mockEnv.RAZORPAYX_ACCOUNT_NUMBER = "";

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      safeForSmokeReuse: false,
      e2eFakePayments: false,
      razorpayxConfigured: false,
      nodeEnv: "development",
    });
  });

  it("returns 404 in production outside E2E runs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_RUN", "0");

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.message).toBe("Not Found");
  });

  it("stays available in production during managed E2E runs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_RUN", "1");

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.safeForSmokeReuse).toBe(true);
    expect(body.data.nodeEnv).toBe("production");
  });
});
