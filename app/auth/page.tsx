"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import React from "react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const router = useRouter();

  async function onCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.ok) {
      router.push("/");
    } else {
      if (res?.error === "NO_ACCOUNT") {
        setError(
          <>
            Account not found.{" "}
            <a href="/choose-role" className="underline">
              Sign up
            </a>
          </>
        );
      } else if (res?.error === "INVALID_CREDENTIALS") {
        setError("Invalid email or password.");
      } else {
        setError(res?.error || "An unknown error occurred");
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 md:flex-row md:items-stretch md:py-16">
        <section className="flex flex-1 flex-col justify-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Secure sign‑in for seekers & providers
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Welcome back to LaundryEase
            </h1>
            <p className="max-w-md text-sm text-muted-foreground md:text-base">
              Pick up where you left off—track active orders, approve invoices,
              or manage your bookings from a single dashboard.
            </p>
          </div>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li>• One login for both web and mobile.</li>
            <li>• 24‑hour escrow protection on all paid orders.</li>
            <li>• Raise complaints directly from your order timeline.</li>
          </ul>
        </section>

        <section className="flex flex-1 items-center">
          <article className="w-full rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
            <header className="mb-6 space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Sign in
              </p>
              <p className="text-sm text-muted-foreground">
                Use Google or your email and password.
              </p>
            </header>

            <button
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              type="button"
            >
              <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
              <span>Continue with Google</span>
            </button>

            <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or continue with email</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="password"
                    className="font-medium text-muted-foreground"
                  >
                    Password
                  </label>
                  <span className="cursor-not-allowed text-[11px] text-muted-foreground/80">
                    Forgot password?
                  </span>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <aside
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
                  role="alert"
                >
                  {error}
                </aside>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <footer className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <a
                href="/choose-role"
                className="font-medium text-emerald-600 hover:text-emerald-500"
              >
                Sign up
              </a>
            </footer>
          </article>
        </section>
      </div>
    </main>
  );
}
