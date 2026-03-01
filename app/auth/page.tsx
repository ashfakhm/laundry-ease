"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, Suspense, useEffect } from "react";
// removed unused useRouter
import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { AppHeader } from "@/components/ui/app-header";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";

function getRoleRedirectPath(role: unknown): string {
  if (role === "seeker") return "/seeker";
  if (role === "provider") return "/provider";
  if (role === "admin") return "/admin";
  return "/choose-role";
}

function AuthPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  // removed const router = useRouter();

  useEffect(() => {
    if (urlError) {
      if (
        urlError === "AccessDenied" ||
        urlError === "OAuthSignin" ||
        urlError === "OAuthCallback"
      ) {
        setError("Google sign-in failed or was cancelled.");
      } else {
        setError(`Authentication error: ${urlError}. Please try again.`);
      }
    }
  }, [urlError]);

  useEffect(() => {
    if (status !== "authenticated") return;
    window.location.href = getRoleRedirectPath(session?.user?.role);
  }, [session?.user?.role, status]);

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
      // Resolve role from canonical session and hard-redirect so server components
      // pick up the fresh auth cookie before rendering dashboard routes.
      try {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const sessionData = await sessionResponse.json().catch(() => null);
        window.location.href = getRoleRedirectPath(sessionData?.user?.role);
        return;
      } catch {
        window.location.href = "/choose-role";
        return;
      }
    } else {
      if (res?.error === "NO_ACCOUNT") {
        setError(
          <>
            Account not found.{" "}
            <Link href="/choose-role" className="underline hover:text-primary">
              Sign up
            </Link>
          </>,
        );
      } else if (res?.error === "INVALID_CREDENTIALS") {
        setError("Invalid email or password.");
      } else {
        setError(res?.error || "An unknown error occurred");
      }
    }
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setForgotLoading(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setForgotSuccess(true);
        setForgotEmail("");
        setTimeout(() => {
          setShowForgotPassword(false);
          setForgotSuccess(false);
        }, 3000);
      } else {
        setError(
          (typeof data?.error === "string" && data.error) ||
            "Failed to send reset email",
        );
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <>
      <AppHeader showAuth={false} />
      <main
        className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8"
        role="main"
        aria-label="Sign in to LaundryEase"
      >
        <div className="w-full max-w-5xl flex flex-col md:flex-row gap-12 items-center">
          {/* Left Side - Brand Promise */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 space-y-8 hidden md:block"
            aria-labelledby="auth-brand-title"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground border border-border/50 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Bank-grade security</span>
            </div>
            <div className="space-y-4">
              <h1
                id="auth-brand-title"
                className="font-heading text-4xl font-bold tracking-tight text-foreground leading-[1.1]"
              >
                Welcome back to <br />{" "}
                <span className="text-primary">LaundryEase</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Manage your premium laundry services. Track orders in real-time,
                approve detailed invoices, and pay securely via escrow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="text-2xl font-bold text-foreground mb-1">
                  24h
                </div>
                <div className="text-sm text-muted-foreground">
                  Escrow Protection
                </div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="text-2xl font-bold text-foreground mb-1">
                  100%
                </div>
                <div className="text-sm text-muted-foreground">
                  Deadline Guarantee
                </div>
              </div>
            </div>
          </motion.section>
          {/* Right Side - Auth Form */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 w-full max-w-md"
            aria-labelledby="auth-form-title"
          >
            <div className="bg-card border border-border/50 shadow-xl shadow-primary/5 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
              {!showForgotPassword ? (
                <>
                  <header className="mb-8 text-center md:text-left">
                    <h2
                      id="auth-form-title"
                      className="text-2xl font-semibold tracking-tight"
                    >
                      Sign in
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Enter your credentials to access your account
                    </p>
                  </header>
                  <button
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
                    onClick={() => signIn("google", { callbackUrl: "/auth" })}
                    type="button"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        className="text-[#4285F4]"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        className="text-[#34A853]"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        className="text-[#FBBC05]"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        className="text-[#EA4335]"
                      />
                    </svg>
                    Continue with Google
                  </button>
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or with email
                      </span>
                    </div>
                  </div>
                  <form
                    onSubmit={onCredentials}
                    className="space-y-5"
                    aria-label="Sign in form"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <PasswordInput
                        id="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    {error && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                  </form>
                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <a
                      href="/choose-role"
                      className="font-medium text-primary hover:underline"
                    >
                      Create account
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowForgotPassword(false)}
                    className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <header className="mb-6">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Reset Password
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      We&apos;ll email you instructions to reset your password.
                    </p>
                  </header>
                  <form
                    onSubmit={handleForgotPassword}
                    className="space-y-5"
                    aria-label="Reset password form"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Email address
                      </label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                      />
                    </div>
                    {forgotSuccess && (
                      <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Check email for instructions.
                      </div>
                    )}
                    {error && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {forgotLoading && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {forgotLoading ? "Sending..." : "Send Reset Link"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.section>
        </div>
      </main>
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}

function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
