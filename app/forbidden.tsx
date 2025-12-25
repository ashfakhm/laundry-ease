import Link from "next/link";
import { Metadata } from "next";
import { ShieldX, Home } from "lucide-react";
import { GoBackButton } from "@/components/ui/go-back-button";

export const metadata: Metadata = {
  title: {
    absolute: "403 - Access Forbidden | LaundryEase",
  },
  description: "You don't have permission to access this resource.",
};

export default function Forbidden() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center gap-6 text-center px-4 py-12"
      role="main"
      aria-label="403 Forbidden"
    >
      <section
        className="rounded-3xl border bg-card/80 p-8 md:p-12 shadow-lg backdrop-blur max-w-lg w-full"
        aria-labelledby="forbidden-title"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <ShieldX className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <header>
          <h1
            className="mt-6 text-4xl font-bold tracking-tight"
            id="forbidden-title"
          >
            403
          </h1>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Access Forbidden
          </h2>
        </header>
        <p className="mt-4 text-muted-foreground">
          You don&apos;t have permission to access this resource. If you believe
          this is an error, please contact support.
        </p>
        <footer className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Go Home"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <GoBackButton />
        </footer>
      </section>
    </main>
  );
}
