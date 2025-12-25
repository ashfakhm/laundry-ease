import Link from "next/link";
import { Metadata } from "next";
import { SearchX, Home } from "lucide-react";
import { GoBackButton } from "@/components/ui/go-back-button";

export const metadata: Metadata = {
  title: {
    absolute: "404 - Page Not Found | LaundryEase",
  },
  description: "The page you're looking for doesn't exist or has been moved.",
};

export default function NotFound() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center gap-6 text-center px-4 py-12"
      role="main"
      aria-label="404 Not Found"
    >
      <section
        className="rounded-3xl border bg-card/80 p-8 md:p-12 shadow-lg backdrop-blur max-w-lg w-full"
        aria-labelledby="notfound-title"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>
        <header>
          <h1
            className="mt-6 text-4xl font-bold tracking-tight"
            id="notfound-title"
          >
            404
          </h1>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Page Not Found
          </h2>
        </header>
        <p className="mt-4 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
