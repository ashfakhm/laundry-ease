import { afterEach, describe, expect, it } from "vitest";
import { buildCspPolicy, getCspHeader } from "./csp";

const ORIGINAL_CSP_ENFORCE = process.env.CSP_ENFORCE;

afterEach(() => {
  if (ORIGINAL_CSP_ENFORCE === undefined) {
    delete process.env.CSP_ENFORCE;
  } else {
    process.env.CSP_ENFORCE = ORIGINAL_CSP_ENFORCE;
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

    const header = getCspHeader();
    expect(header.key).toBe("Content-Security-Policy");
  });
});

