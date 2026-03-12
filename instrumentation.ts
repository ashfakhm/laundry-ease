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
  }
}
