import Link from "next/link";
import { Metadata } from "next";
import { Lock, LogIn, Home } from "lucide-react";

export const metadata: Metadata = {
  title: {
    absolute: "Unauthorized - Login Required | LaundryEase",
  },
  description: "Please sign in to access this page on LaundryEase.",
};

export default function Unauthorized() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center gap-6 text-center px-4 py-12"
      role="main"
      aria-label="401 Unauthorized"
    >
      <section
        className="rounded-3xl border bg-card/80 p-8 md:p-12 shadow-lg backdrop-blur max-w-lg w-full"
        aria-labelledby="unauth-title"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
          <Lock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>
        <header>
          <h1
            className="mt-6 text-4xl font-bold tracking-tight"
            id="unauth-title"
          >
            401
          </h1>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Unauthorized Access
          </h2>
        </header>
        <p className="mt-4 text-muted-foreground">
          You need to sign in to access this page. Please log in with your
          account.
        </p>
        <footer className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/auth"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Sign In"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Go Home"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </footer>
      </section>
    </main>
  );
}
