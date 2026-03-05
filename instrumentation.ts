/**
 * APM (Application Performance Monitoring) Initialization Hook
 *
 * This file is automatically executed by Next.js at startup.
 * It's the standard entry point for initializing metrics and telemetry
 * tools like Datadog, New Relic, Sentry, or OpenTelemetry.
 *
 * For now, this serves as a foundation that can be flexibly expanded
 * when the application scales up to require full APM.
 */
import { logger } from "@/lib/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Force public DNS servers so SRV lookups for mongodb+srv:// URIs
    // succeed on networks whose local DNS doesn't support SRV queries.
    if (process.env.MONGODB_URI?.startsWith("mongodb+srv://")) {
      const dns = await import("node:dns");
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"]);
    }
    // Initialize server-side APM here
    if (process.env.DATADOG_API_KEY || process.env.DD_API_KEY) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tracer = require("dd-trace");
      tracer.init({
        service: "laundryease-web",
        env: process.env.NODE_ENV,
        version: process.env.npm_package_version || "0.1.0",
        logInjection: true,
      });

      logger.info("APM", "Datadog tracer initialized successfully.");
    } else if (process.env.NODE_ENV === "production") {
      logger.warn(
        "APM",
        "[APM] Instrumentation hook ready, but no DATADOG_API_KEY found. APM disabled.",
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Initialize edge-side APM here if supported
  }
}
