import { describe, expect, it, vi } from "vitest";

import { selectPlaywrightServerStrategy } from "./playwright-server-selection.mjs";

describe("selectPlaywrightServerStrategy", () => {
  it("falls back to the managed server and clears a stale lock when nothing is reachable", async () => {
    const pingServerFn = vi.fn().mockResolvedValue(false);
    const fetchRuntimeProbeFn = vi.fn();

    const result = await selectPlaywrightServerStrategy({
      lockExists: true,
      pingServerFn,
      fetchRuntimeProbeFn,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: "managed",
        clearLock: true,
      }),
    );
    expect(fetchRuntimeProbeFn).not.toHaveBeenCalled();
  });

  it("reuses a reachable server only when the probe marks it safe", async () => {
    const pingServerFn = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const fetchRuntimeProbeFn = vi.fn().mockResolvedValue({
      safeForSmokeReuse: true,
      e2eFakePayments: true,
      razorpayxConfigured: true,
      nodeEnv: "development",
    });

    const result = await selectPlaywrightServerStrategy({
      lockExists: true,
      pingServerFn,
      fetchRuntimeProbeFn,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: "reuse",
        clearLock: false,
        reuseUrl: "http://127.0.0.1:3405",
      }),
    );
  });

  it("falls back to the managed server when an auto-discovered server is unsafe", async () => {
    const pingServerFn = vi.fn().mockResolvedValue(true);
    const fetchRuntimeProbeFn = vi.fn().mockResolvedValue({
      safeForSmokeReuse: false,
      e2eFakePayments: false,
      razorpayxConfigured: false,
      nodeEnv: "development",
    });

    const result = await selectPlaywrightServerStrategy({
      lockExists: true,
      pingServerFn,
      fetchRuntimeProbeFn,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: "managed",
        clearLock: false,
      }),
    );
    expect(result.reason).toContain("did not pass the smoke E2E runtime probe");
  });

  it("fails fast when an explicit E2E_BASE_URL is reachable but unsafe", async () => {
    const pingServerFn = vi.fn().mockResolvedValue(true);
    const fetchRuntimeProbeFn = vi.fn().mockResolvedValue({
      safeForSmokeReuse: false,
      e2eFakePayments: false,
      razorpayxConfigured: true,
      nodeEnv: "production",
    });

    const result = await selectPlaywrightServerStrategy({
      lockExists: false,
      explicitBaseUrl: "https://staging.example.test",
      pingServerFn,
      fetchRuntimeProbeFn,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: "error",
        clearLock: false,
      }),
    );
    expect(result.reason).toContain("E2E_BASE_URL");
    expect(result.reason).toContain("enable E2E_FAKE_PAYMENTS=1");
  });
});
