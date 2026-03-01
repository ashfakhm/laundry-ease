import { afterEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  CSP_ENFORCE: "false" as string | undefined,
  CSP_ALLOW_UNSAFE_EVAL: "false" as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

import { buildCspPolicy, getCspHeader } from "./csp";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  mockEnv.CSP_ENFORCE = "false";
  mockEnv.CSP_ALLOW_UNSAFE_EVAL = "false";
  if (ORIGINAL_NODE_ENV === undefined) {
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

describe("buildCspPolicy", () => {
  it("includes security-critical directives and report endpoint", () => {
    const policy = buildCspPolicy();

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://maps.googleapis.com",
    );
    expect(policy).toContain("report-uri /api/security/csp-report");
  });

  it("drops unsafe-eval in enforce mode by default", () => {
    const policy = buildCspPolicy({ enforce: true });
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://maps.googleapis.com",
    );
  });
});

describe("getCspHeader", () => {
  it("returns report-only header by default", () => {
    mockEnv.CSP_ENFORCE = undefined;

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy-Report-Only");
    expect(header.value).toContain("default-src 'self'");
  });

  it("returns enforcement header when CSP_ENFORCE=true", () => {
    mockEnv.CSP_ENFORCE = "true";
    mockEnv.CSP_ALLOW_UNSAFE_EVAL = undefined;

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
    expect(header.value).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-eval override in enforce mode when explicitly enabled", () => {
    mockEnv.CSP_ENFORCE = "true";
    mockEnv.CSP_ALLOW_UNSAFE_EVAL = "true";

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
    expect(header.value).toContain("'unsafe-eval'");
  });

  it("defaults to enforced CSP in production when not explicitly disabled", () => {
    mockEnv.CSP_ENFORCE = undefined;
    env.NODE_ENV = "production";

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
    expect(header.value).not.toContain("'unsafe-eval'");
  });

  it("keeps report-only header when CSP_ENFORCE=false in production", () => {
    mockEnv.CSP_ENFORCE = "false";
    env.NODE_ENV = "production";

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy-Report-Only");
  });
});
