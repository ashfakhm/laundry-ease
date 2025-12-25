"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to monitoring service in production
    console.error("Global error:", error);
  }, [error]);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-900"
      role="main"
      aria-label="Error"
    >
      <section
        className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800"
        aria-labelledby="error-title"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <header>
          <h2
            id="error-title"
            className="mt-4 text-xl font-semibold text-gray-900 dark:text-white"
          >
            Critical Error
          </h2>
        </header>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            Error ID: {error.digest}
          </p>
        )}
        <footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            aria-label="Try again"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            aria-label="Go home"
          >
            Go home
          </button>
        </footer>
      </section>
    </main>
  );
}
