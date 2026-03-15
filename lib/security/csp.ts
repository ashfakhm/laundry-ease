// Read CSP env vars directly from process.env to avoid pulling in lib/env.ts
// (which uses Zod parse and path aliases unsupported by next.config.ts bundling).

const DEFAULT_REPORT_URI = "/api/security/csp-report";

export type CspBuildOptions = {
  reportUri?: string;
  enforce?: boolean;
};

function directive(name: string, values: string[]): string {
  return `${name} ${values.join(" ")}`;
}

export function buildCspPolicy(options: CspBuildOptions = {}): string {
  const reportUri = options.reportUri ?? DEFAULT_REPORT_URI;
  const enforce = options.enforce ?? false;
  const allowUnsafeEval = process.env.CSP_ALLOW_UNSAFE_EVAL === "true";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://checkout.razorpay.com",
    "https://maps.googleapis.com",
  ];
  if (!enforce || allowUnsafeEval) {
    scriptSrc.splice(2, 0, "'unsafe-eval'");
  }

  const directives: string[] = [
    directive("default-src", ["'self'"]),
    directive("base-uri", ["'self'"]),
    directive("form-action", ["'self'"]),
    directive("frame-ancestors", ["'none'"]),
    directive("object-src", ["'none'"]),
    directive("script-src", scriptSrc),
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
      // WebSocket transports for Socket.IO (complaint chat, real-time events).
      // ws: covers http/localhost dev; wss: covers production HTTPS.
      // CORS on the Socket.IO server already restricts which origins may connect.
      "ws:",
      process.env.NODE_ENV === "production" &&
      (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL)
        ? (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL)!.replace(
            /^http/,
            "ws",
          )
        : "wss:",
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
    // Only upgrade insecure requests in production (HTTPS).
    // On localhost (plain HTTP) this directive would cause the browser to
    // rewrite all http:// sub-resource requests — including Socket.IO polling
    // transport — to https://, breaking them silently.
    ...(process.env.NODE_ENV === "production"
      ? ["upgrade-insecure-requests"]
      : []),
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

export function getCspHeader() {
  const enforceFlag = process.env.CSP_ENFORCE;
  const enforce =
    enforceFlag === "true" ||
    (enforceFlag !== "false" && process.env.NODE_ENV === "production");
  return {
    key: enforce
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: buildCspPolicy({ enforce }),
  };
}
