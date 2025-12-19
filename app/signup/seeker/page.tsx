"use client";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

async function postJSON(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as const;
}

export default function SeekerSignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: {
      line1: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      landmark: "",
    },
  });
  const [emailOtpSent, setEmailOtpSent] = useState<string | null>(null);
  const [phoneOtpSent, setPhoneOtpSent] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSending, startEmailSend] = useTransition();
  const [phoneSending, startPhoneSend] = useTransition();
  const [emailVerifying, startEmailVerify] = useTransition();
  const [phoneVerifying, startPhoneVerify] = useTransition();

  // Normalize phone to E.164; default to +91 for 10-digit Indian numbers
  function normalizePhone(input: string) {
    const raw = (input || "").trim();
    if (!raw) return "";
    if (raw.startsWith("+")) return raw;
    const digits = raw.replace(/\D+/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    // Fallback: if user typed leading 0 then 10 digits
    if (digits.length === 11 && digits.startsWith("0"))
      return `+91${digits.slice(1)}`;
    // If we cannot confidently infer, prefix + and let backend/SMS provider validate
    return raw.startsWith("+") ? raw : `+${digits || raw}`;
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setAddr<K extends keyof typeof form.address>(k: K, v: string) {
    setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));
  }

  function sendEmailOtp() {
    startEmailSend(async () => {
      setError(null);
      const { ok, data } = await postJSON("/api/otp/request", {
        target: form.email,
        type: "email",
      });
      if (!ok) return setError(data?.error || "Failed to send email OTP");
      setEmailOtpSent("OTP sent to your email");
    });
  }
  function sendPhoneOtp() {
    startPhoneSend(async () => {
      setError(null);
      const { ok, data } = await postJSON("/api/otp/request", {
        target: normalizePhone(form.phone),
        type: "phone",
      });
      if (!ok) return setError(data?.error || "Failed to send phone OTP");
      setPhoneOtpSent("OTP sent via SMS");
    });
  }
  function verifyEmail() {
    startEmailVerify(async () => {
      setError(null);
      if (!form.email) return setError("Please enter your email first");
      if (!emailCode) return setError("Please enter the verification code");
      const { ok, data } = await postJSON("/api/otp/verify", {
        target: form.email,
        type: "email",
        code: emailCode,
      });
      if (!ok)
        return setError(
          data?.error ||
            "The 6-digit code you entered is incorrect. Please try again."
        );
      setEmailVerified(true);
    });
  }
  function verifyPhone() {
    startPhoneVerify(async () => {
      setError(null);
      if (!form.phone) return setError("Please enter your phone number first");
      if (!phoneCode) return setError("Please enter the verification code");
      const { ok, data } = await postJSON("/api/otp/verify", {
        target: normalizePhone(form.phone),
        type: "phone",
        code: phoneCode,
      });
      if (!ok)
        return setError(
          data?.error ||
            "The 6-digit code you entered is incorrect. Please try again."
        );
      setPhoneVerified(true);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailVerified || !phoneVerified)
      return setError("Verify email and phone first");
    setLoading(true);
    const { ok, data } = await postJSON("/api/signup/seeker", {
      ...form,
      phone: normalizePhone(form.phone),
    });
    setLoading(false);
    if (!ok) return setError(data?.error || "Signup failed");
    // Auto sign-in via credentials
    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: true,
      callbackUrl: "/",
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 md:flex-row md:items-stretch md:py-16">
        {/* Left rail: brand + benefits */}
        <section className="flex flex-1 flex-col justify-between rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Secure seeker onboarding
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Create your LaundryEase account
              </h1>
              <p className="max-w-md text-sm text-muted-foreground md:text-base">
                One account to book pickups, track orders in real time, and keep
                all your invoices in one safe place.
              </p>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-emerald-600/10 text-emerald-500 ring-1 ring-emerald-500/30 flex items-center justify-center text-xs">
                  ✓
                </span>
                <span>Two-step OTP verification for email and phone.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-emerald-600/10 text-emerald-500 ring-1 ring-emerald-500/30 flex items-center justify-center text-xs">
                  ✓
                </span>
                <span>Save multiple addresses for faster future bookings.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-5 w-5 rounded-full bg-emerald-600/10 text-emerald-500 ring-1 ring-emerald-500/30 flex items-center justify-center text-xs">
                  ✓
                </span>
                <span>
                  Escrow-backed payments to keep every order protected.
                </span>
              </li>
            </ul>
          </div>

          <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/auth"
              className="font-medium text-emerald-600 hover:text-emerald-500"
            >
              Sign in
            </a>
          </footer>
        </section>

        {/* Right rail: form */}
        <section className="flex flex-1 flex-col">
          <form
            onSubmit={submit}
            className="flex h-full flex-col rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm md:p-8"
          >
            <header className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Step 1 of 2
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Personal & contact details
                </h2>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30 md:flex">
                <span className="text-lg font-semibold">S</span>
              </div>
            </header>

            <div className="space-y-8 overflow-y-auto pr-1">
              <fieldset className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Full name
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Email
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      type="email"
                      placeholder="Enter your email address"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-xl border bg-background px-4 py-2.5 pr-10 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 cursor-text"
                        type="password"
                        placeholder="Enter your password"
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        required
                        id="password-seeker"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById(
                            "password-seeker"
                          ) as HTMLInputElement;
                          if (input) {
                            input.type =
                              input.type === "password" ? "text" : "password";
                          }
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Phone number
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your phone number"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      We’ll automatically add +91 if you enter a 10‑digit Indian
                      mobile number.
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Address
                </legend>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Street address
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your street address"
                      value={form.address.line1}
                      onChange={(e) => setAddr("line1", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      City
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your city"
                      value={form.address.city}
                      onChange={(e) => setAddr("city", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      State
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your state"
                      value={form.address.state}
                      onChange={(e) => setAddr("state", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Country
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your country"
                      value={form.address.country}
                      onChange={(e) => setAddr("country", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Postal code
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter your postal code"
                      value={form.address.postalCode}
                      onChange={(e) => setAddr("postalCode", e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Nearby landmark (optional)
                    </label>
                    <input
                      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter a nearby landmark"
                      value={form.address.landmark}
                      onChange={(e) => setAddr("landmark", e.target.value)}
                    />
                  </div>
                </div>
              </fieldset>

              <section className="space-y-3 rounded-2xl border bg-background px-4 py-4 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Step 2 · Verify contact details
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We’ll send you a 6‑digit code on both email and SMS.
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-600 ring-1 ring-emerald-500/20 md:inline-flex">
                    Required for booking
                  </span>
                </div>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {/* Email OTP */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Email verification
                      </span>
                      {emailVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 ring-1 ring-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Verified
                        </span>
                      )}
                    </div>
                    {!emailVerified && (
                      <div className="flex gap-2">
                        {!emailOtpSent ? (
                          <button
                            type="button"
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted"
                            onClick={sendEmailOtp}
                            disabled={!form.email || emailSending}
                          >
                            {emailSending ? "Sending..." : "Send code"}
                          </button>
                        ) : (
                          <>
                            <input
                              className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              placeholder="6-digit code"
                              value={emailCode}
                              onChange={(e) => setEmailCode(e.target.value)}
                              maxLength={6}
                            />
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted"
                              onClick={verifyEmail}
                              disabled={emailVerifying}
                            >
                              {emailVerifying ? "..." : "Verify"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {emailOtpSent && !emailVerified && (
                      <p className="text-[11px] text-emerald-600">
                        {emailOtpSent}
                      </p>
                    )}
                  </div>

                  {/* Phone OTP */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Phone verification
                      </span>
                      {phoneVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 ring-1 ring-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Verified
                        </span>
                      )}
                    </div>
                    {!phoneVerified && (
                      <div className="flex gap-2">
                        {!phoneOtpSent ? (
                          <button
                            type="button"
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted"
                            onClick={sendPhoneOtp}
                            disabled={!form.phone || phoneSending}
                          >
                            {phoneSending ? "Sending..." : "Send code"}
                          </button>
                        ) : (
                          <>
                            <input
                              className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              placeholder="6-digit code"
                              value={phoneCode}
                              onChange={(e) => setPhoneCode(e.target.value)}
                              maxLength={6}
                            />
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted"
                              onClick={verifyPhone}
                              disabled={phoneVerifying}
                            >
                              {phoneVerifying ? "..." : "Verify"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {phoneOtpSent && !phoneVerified && (
                      <p className="text-[11px] text-emerald-600">
                        {phoneOtpSent}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-foreground">
                By creating an account, you agree to our{" "}
                <span className="font-medium text-emerald-600">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="font-medium text-emerald-600">
                  Privacy Policy
                </span>
                .
              </p>
              <div className="flex flex-col gap-2">
                {error && (
                  <aside
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </aside>
                )}
                <button
                  type="submit"
                  disabled={loading || !emailVerified || !phoneVerified}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
