"use client";

/**
 * Client-side error reporting utility.
 *
 * All client components should use `reportError()` instead of `console.error()`.
 * Currently logs to the browser console; swap the implementation to Sentry,
 * LogRocket, or any error-monitoring service when ready — single change point.
 */

export function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);

  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, error, extra);
  }

  // TODO(sentry): Replace with Sentry.captureException(error, { tags: { context }, extra })
  // For now, structured console output in production for DevTools debugging
  if (process.env.NODE_ENV === "production") {
    console.error(
      JSON.stringify({ context, message, ...(extra ? { extra } : {}) }),
    );
  }
}
