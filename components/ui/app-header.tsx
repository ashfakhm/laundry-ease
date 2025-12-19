"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

interface AppHeaderProps {
  showAuth?: boolean;
}

export function AppHeader({ showAuth = true }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-sm">
            LE
          </span>
          <span className="text-lg font-semibold tracking-tight">
            LaundryEase
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {showAuth && (
            <div className="flex items-center gap-2">
              <Link
                href="/choose-role"
                className="hidden rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted sm:inline-flex"
              >
                Get Started
              </Link>
              <Link
                href="/auth"
                className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
