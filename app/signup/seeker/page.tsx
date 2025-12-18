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
      if (!ok) return setError(data?.error || "Invalid email code");
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900">
      <form onSubmit={submit} className="w-full max-w-4xl">
        <article className="bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-700">
          <header className="text-center space-y-3">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white">
              Create Seeker Account
            </h1>
            <p className="text-gray-400 text-lg">
              Join to find laundry services near you
            </p>
          </header>

          {error && (
            <aside
              className="p-4 rounded-lg bg-red-900/50 border border-red-700"
              role="alert"
            >
              <p className="text-sm text-red-400">{error}</p>
            </aside>
          )}

          <fieldset className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                  className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="+1234567890"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  We’ll automatically add +91 for Indian mobile numbers.
                </p>
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-lg font-semibold text-white">
                Address
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Street Address
                  </label>
                  <input
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="123 Main St"
                    value={form.address.line1}
                    onChange={(e) => setAddr("line1", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    City
                  </label>
                  <input
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="New York"
                    value={form.address.city}
                    onChange={(e) => setAddr("city", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    State
                  </label>
                  <input
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="NY"
                    value={form.address.state}
                    onChange={(e) => setAddr("state", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Country
                  </label>
                  <input
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="USA"
                    value={form.address.country}
                    onChange={(e) => setAddr("country", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Postal Code
                  </label>
                  <input
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="10001"
                    value={form.address.postalCode}
                    onChange={(e) => setAddr("postalCode", e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nearby Landmark (Optional)
                  </label>
                  <input
                    className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Near Central Park"
                    value={form.address.landmark}
                    onChange={(e) => setAddr("landmark", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </fieldset>

          <section className="space-y-4 border border-gray-600 rounded-xl p-6 bg-gray-700/50">
            <h2 className="font-semibold text-lg text-white">Verification</h2>

            <div className="space-y-4">
              {/* Email OTP */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">
                    Email Verification
                  </label>
                  {emailVerified && (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  )}
                </div>
                {!emailVerified && (
                  <div className="flex gap-2">
                    {!emailOtpSent ? (
                      <button
                        type="button"
                        className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                        onClick={sendEmailOtp}
                        disabled={!form.email || emailSending}
                      >
                        {emailSending ? "Sending..." : "Send OTP"}
                      </button>
                    ) : (
                      <>
                        <input
                          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                          placeholder="Enter 6-digit code"
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value)}
                          maxLength={6}
                        />
                        <button
                          type="button"
                          className="px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                          onClick={verifyEmail}
                          disabled={emailVerifying}
                        >
                          {emailVerifying ? "Verifying..." : "Verify"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {emailOtpSent && !emailVerified && (
                  <p className="text-sm text-green-400 font-medium mt-2">
                    {emailOtpSent}
                  </p>
                )}
              </div>

              {/* Phone OTP */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">
                    Phone Verification
                  </label>
                  {phoneVerified && (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  )}
                </div>
                {!phoneVerified && (
                  <div className="flex gap-2">
                    {!phoneOtpSent ? (
                      <button
                        type="button"
                        className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                        onClick={sendPhoneOtp}
                        disabled={!form.phone || phoneSending}
                      >
                        {phoneSending ? "Sending..." : "Send OTP"}
                      </button>
                    ) : (
                      <>
                        <input
                          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                          placeholder="Enter 6-digit code"
                          value={phoneCode}
                          onChange={(e) => setPhoneCode(e.target.value)}
                          maxLength={6}
                        />
                        <button
                          type="button"
                          className="px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                          onClick={verifyPhone}
                          disabled={phoneVerifying}
                        >
                          {phoneVerifying ? "Verifying..." : "Verify"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {phoneOtpSent && !phoneVerified && (
                  <p className="text-sm text-green-400 font-medium mt-2">
                    {phoneOtpSent}
                  </p>
                )}
              </div>
            </div>
          </section>

          <button
            disabled={loading || !emailVerified || !phoneVerified}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-2xl transform hover:-translate-y-0.5"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </article>
      </form>
    </main>
  );
}
