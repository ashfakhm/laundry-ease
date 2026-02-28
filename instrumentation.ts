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

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize server-side APM here
    // Example:
    // if (process.env.DATADOG_API_KEY) {
    //   require('dd-trace').init();
    // }

    // For now, just log that the APM hook is ready
    if (process.env.NODE_ENV === "production") {
      console.log(
        "[APM] Instrumentation hook registered and ready for Datadog/NewRelic integration.",
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Initialize edge-side APM here if supported
  }
}
