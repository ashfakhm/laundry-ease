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

export default function ProviderSignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    businessName: "",
    bio: "",
    description: "",
    location: "",
    tags: "",
  });
  const [pricingRates, setPricingRates] = useState<
    { item: string; rate: string }[]
  >([
    { item: "Shirt", rate: "" },
    { item: "Pant", rate: "" },
    { item: "Bedsheet", rate: "" },
  ]);
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
    if (digits.length === 11 && digits.startsWith("0"))
      return `+91${digits.slice(1)}`;
    return raw.startsWith("+") ? raw : `+${digits || raw}`;
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateRate(index: number, field: "item" | "rate", value: string) {
    setPricingRates((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  }

  function addPricingRow() {
    setPricingRates((prev) => [...prev, { item: "", rate: "" }]);
  }

  function removePricingRow(index: number) {
    if (pricingRates.length > 1) {
      setPricingRates((prev) => prev.filter((_, i) => i !== index));
    }
  }

  async function sendEmailOtp() {
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

  async function sendPhoneOtp() {
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

  async function verifyEmail() {
    startEmailVerify(async () => {
      setError(null);
      if (!form.email) return setError("Please enter your email first");
      if (!emailCode) return setError("Please enter the verification code");
      const { ok, data } = await postJSON("/api/otp/verify", {
        target: form.email,
        type: "email",
        code: emailCode,
      });
      if (!ok) return setError(data?.error || "Invalid email code");
      setEmailVerified(true);
    });
  }

  async function verifyPhone() {
    startPhoneVerify(async () => {
      setError(null);
      if (!form.phone) return setError("Please enter your phone number first");
      if (!phoneCode) return setError("Please enter the verification code");
      const { ok, data } = await postJSON("/api/otp/verify", {
        target: normalizePhone(form.phone),
        type: "phone",
        code: phoneCode,
      });
      if (!ok) return setError(data?.error || "Invalid phone code");
      setPhoneVerified(true);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailVerified || !phoneVerified)
      return setError("Verify email and phone first");
    setLoading(true);
    // Convert pricing rates array to object
    const ratesObj = pricingRates.reduce((acc, { item, rate }) => {
      if (item && rate) {
        acc[item] = Number(rate) || 0;
      }
      return acc;
    }, {} as Record<string, number>);

    const { ok, data } = await postJSON("/api/signup/provider", {
      name: form.name,
      email: form.email,
      password: form.password,
      phone: normalizePhone(form.phone),
      businessName: form.businessName,
      bio: form.bio,
      description: form.description,
      pricingRates: ratesObj,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      location: form.location,
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
        {/* Left rail: explanation */}
        <section className="flex flex-1 flex-col justify-between rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Provider onboarding · takes about 3 minutes
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Create your provider account
              </h1>
              <p className="max-w-md text-sm text-muted-foreground md:text-base">
                Add your business details, pricing, and service area so seekers
                can discover and book you with upfront, escrow‑backed payments.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Set transparent per‑item pricing for your services.</li>
              <li>• Define service areas and delivery options.</li>
              <li>• Receive payouts after a 24‑hour escrow window.</li>
            </ul>
          </div>
          <footer className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            Want to book laundry instead?{" "}
            <a
              href="/signup/seeker"
              className="font-medium text-emerald-600 hover:text-emerald-500"
            >
              Create a seeker account
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
                  Provider details
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We use this information to show seekers who you are and where
                  you operate.
                </p>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/30 md:flex">
                <span className="text-lg font-semibold">P</span>
              </div>
            </header>

            {error && (
              <aside
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
                role="alert"
              >
                {error}
              </aside>
            )}

            <div className="space-y-8 overflow-y-auto pr-1">
              <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Full name
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Owner name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Business name
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="LaundryPro Services"
                    value={form.businessName}
                    onChange={(e) => set("businessName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Email
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    type="email"
                    placeholder="business@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Password
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Phone number
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    We’ll automatically add +91 if you enter a 10‑digit Indian
                    mobile number.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Service area
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="City, locality (e.g., Andheri West)"
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                    required
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Public profile
                </legend>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Bio / tagline
                  </label>
                  <input
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Fast, reliable, eco‑friendly laundry service"
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    maxLength={200}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {form.bio.length}/200 characters
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Tell seekers about your experience, turnaround time, and what makes your service stand out."
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={4}
                    required
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3 rounded-2xl border bg-background px-4 py-4 text-sm shadow-sm">
                <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Pricing rates
                </legend>
                <p className="text-xs text-muted-foreground">
                  Add common items and their base rates. You can refine this
                  later from your provider dashboard.
                </p>
                <div className="space-y-2">
                  {pricingRates.map((rate, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        placeholder="Item (e.g., Shirt)"
                        value={rate.item}
                        onChange={(e) =>
                          updateRate(idx, "item", e.target.value)
                        }
                        required
                      />
                      <input
                        className="w-28 rounded-xl border bg-background px-3 py-2 text-xs outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        placeholder="Rate (₹)"
                        inputMode="decimal"
                        value={rate.rate}
                        onChange={(e) =>
                          updateRate(idx, "rate", e.target.value)
                        }
                        required
                      />
                      {pricingRates.length > 1 && (
                        <button
                          type="button"
                          className="rounded-xl border bg-background px-2 text-xs text-red-500 hover:bg-red-50"
                          onClick={() => removePricingRow(idx)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded-xl border bg-background px-3 py-2 text-xs font-medium text-sky-600 hover:bg-sky-50"
                    onClick={addPricingRow}
                  >
                    + Add custom item
                  </button>
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tags
                </legend>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Type tags separated by comma (e.g., eco‑friendly, same‑day, pickup‑available)"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  required
                />
                {form.tags && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {form.tags
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </fieldset>

              <section className="space-y-3 rounded-2xl border bg-background px-4 py-4 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Contact verification
                    </h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      We require OTP verification on both email and phone to
                      keep the marketplace healthy.
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-600 ring-1 ring-emerald-500/20 md:inline-flex">
                    Required to accept orders
                  </span>
                </div>

                <div className="mt-2 grid gap-4 md:grid-cols-2">
                  {/* Email OTP */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
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
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">
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
                By continuing, you agree to LaundryEase&apos;s{" "}
                <span className="font-medium text-sky-600">Provider Terms</span>{" "}
                and{" "}
                <span className="font-medium text-sky-600">Privacy Policy</span>
                .
              </p>
              <button
                type="submit"
                disabled={loading || !emailVerified || !phoneVerified}
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-muted"
              >
                {loading ? "Creating account..." : "Create provider account"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
