"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid reset link");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isStrongPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/auth");
        }, 2000);
      } else {
        setError(
          (typeof data?.error === "string" && data.error) ||
            "Failed to reset password",
        );
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <>
        <AppHeader showAuth={false} />
        <main className="min-h-screen bg-background">
          <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 md:flex-row md:items-stretch md:py-16">
            <section className="flex flex-1 items-center">
              <article className="w-full rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
                <div className="space-y-4 text-center">
                  <h1 className="text-2xl font-semibold">Invalid Reset Link</h1>
                  <p className="text-sm text-muted-foreground">
                    The password reset link is missing or invalid. Please
                    request a new one.
                  </p>
                  <a
                    href="/auth"
                    className="inline-block px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 cursor-pointer transition"
                  >
                    Back to Sign In
                  </a>
                </div>
              </article>
            </section>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 md:flex-row md:items-stretch md:py-16">
          <section className="flex flex-1 flex-col justify-center gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Secure password reset
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Create a new password
              </h1>
              <p className="max-w-md text-sm text-muted-foreground md:text-base">
                Enter a strong password to secure your LaundryEase account.
              </p>
            </div>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>• Use at least 8 characters.</li>
              <li>• Include at least one uppercase letter.</li>
              <li>• Include at least one number and one special character.</li>
            </ul>
          </section>

          <section className="flex flex-1 items-center">
            <article className="w-full rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
              <header className="mb-6 space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Reset password
                </p>
                <p className="text-sm text-muted-foreground">
                  Create a new password for your account.
                </p>
              </header>

              {success ? (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <p className="font-medium">Password reset successful!</p>
                  <p>Redirecting to sign in...</p>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        className="w-full rounded-xl border bg-background px-4 py-2.5 pr-10 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 cursor-text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="confirm-password"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        className="w-full rounded-xl border bg-background px-4 py-2.5 pr-10 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 cursor-text"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
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
                    className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted cursor-pointer"
                  >
                    {loading ? "Resetting..." : "Reset password"}
                  </button>
                </form>
              )}

              <footer className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">
                Remember your password?{" "}
                <a
                  href="/auth"
                  className="font-medium text-emerald-600 hover:text-emerald-500 cursor-pointer"
                >
                  Sign in
                </a>
              </footer>
            </article>
          </section>
        </div>
      </main>
    </>
  );
}
