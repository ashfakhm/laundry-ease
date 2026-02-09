import { afterEach, describe, expect, it } from "vitest";
import { buildCspPolicy, getCspHeader } from "./csp";

const ORIGINAL_CSP_ENFORCE = process.env.CSP_ENFORCE;
const ORIGINAL_CSP_ALLOW_UNSAFE_EVAL = process.env.CSP_ALLOW_UNSAFE_EVAL;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  if (ORIGINAL_CSP_ENFORCE === undefined) {
    delete process.env.CSP_ENFORCE;
  } else {
    process.env.CSP_ENFORCE = ORIGINAL_CSP_ENFORCE;
  }

  if (ORIGINAL_CSP_ALLOW_UNSAFE_EVAL === undefined) {
    delete process.env.CSP_ALLOW_UNSAFE_EVAL;
  } else {
    process.env.CSP_ALLOW_UNSAFE_EVAL = ORIGINAL_CSP_ALLOW_UNSAFE_EVAL;
  }

  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
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
    delete process.env.CSP_ENFORCE;

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy-Report-Only");
    expect(header.value).toContain("default-src 'self'");
  });

  it("returns enforcement header when CSP_ENFORCE=true", () => {
    process.env.CSP_ENFORCE = "true";
    delete process.env.CSP_ALLOW_UNSAFE_EVAL;

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
    expect(header.value).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-eval override in enforce mode when explicitly enabled", () => {
    process.env.CSP_ENFORCE = "true";
    process.env.CSP_ALLOW_UNSAFE_EVAL = "true";

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
    expect(header.value).toContain("'unsafe-eval'");
  });

  it("defaults to enforced CSP in production when not explicitly disabled", () => {
    delete process.env.CSP_ENFORCE;
    process.env.NODE_ENV = "production";

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
    expect(header.value).not.toContain("'unsafe-eval'");
  });

  it("keeps report-only header when CSP_ENFORCE=false in production", () => {
    process.env.CSP_ENFORCE = "false";
    process.env.NODE_ENV = "production";

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy-Report-Only");
  });
});
