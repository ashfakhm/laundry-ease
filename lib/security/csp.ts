const DEFAULT_REPORT_URI = "/api/security/csp-report";

export type CspBuildOptions = {
  reportUri?: string;
};

function directive(name: string, values: string[]): string {
  return `${name} ${values.join(" ")}`;
}

export function buildCspPolicy(options: CspBuildOptions = {}): string {
  const reportUri = options.reportUri ?? DEFAULT_REPORT_URI;

  const directives: string[] = [
    directive("default-src", ["'self'"]),
    directive("base-uri", ["'self'"]),
    directive("form-action", ["'self'"]),
    directive("frame-ancestors", ["'none'"]),
    directive("object-src", ["'none'"]),
    directive("script-src", [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://checkout.razorpay.com",
      "https://maps.googleapis.com",
    ]),
    directive("style-src", ["'self'", "'unsafe-inline'"]),
    directive("img-src", [
      "'self'",
      "data:",
      "blob:",
      "https://res.cloudinary.com",
      "https://maps.googleapis.com",
      "https://maps.gstatic.com",
    ]),
    directive("font-src", ["'self'", "data:"]),
    directive("connect-src", [
      "'self'",
      "https://api.razorpay.com",
      "https://lumberjack.razorpay.com",
      "https://maps.googleapis.com",
      "https://maps.gstatic.com",
      "https://api.cloudinary.com",
      "https://res.cloudinary.com",
    ]),
    directive("frame-src", [
      "'self'",
      "https://checkout.razorpay.com",
      "https://api.razorpay.com",
    ]),
    directive("worker-src", ["'self'", "blob:"]),
    "upgrade-insecure-requests",
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

export function getCspHeader() {
  const enforce = process.env.CSP_ENFORCE === "true";
  return {
    key: enforce
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: buildCspPolicy(),
  };
}

