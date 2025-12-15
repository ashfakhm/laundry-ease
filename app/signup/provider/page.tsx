"use client";
import { useState } from "react";
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
    setError(null);
    const { ok, data } = await postJSON("/api/otp/request", {
      target: form.email,
      type: "email",
    });
    if (!ok) return setError(data?.error || "Failed to send email OTP");
    setEmailOtpSent(data.devCode || "sent");
  }

  async function sendPhoneOtp() {
    setError(null);
    const { ok, data } = await postJSON("/api/otp/request", {
      target: form.phone,
      type: "phone",
    });
    if (!ok) return setError(data?.error || "Failed to send phone OTP");
    setPhoneOtpSent(data.devCode || "sent");
  }

  async function verifyEmail() {
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
  }

  async function verifyPhone() {
    setError(null);
    if (!form.phone) return setError("Please enter your phone number first");
    if (!phoneCode) return setError("Please enter the verification code");
    const { ok, data } = await postJSON("/api/otp/verify", {
      target: form.phone,
      type: "phone",
      code: phoneCode,
    });
    if (!ok) return setError(data?.error || "Invalid phone code");
    setPhoneVerified(true);
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
      phone: form.phone,
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900">
      <form onSubmit={submit} className="w-full max-w-4xl">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-700">
          <div className="text-center space-y-3">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
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
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white">
              Create Provider Account
            </h1>
            <p className="text-gray-400 text-lg">
              Start offering your laundry services
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-900/50 border border-red-700">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Full Name
              </label>
              <input
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Business Name
              </label>
              <input
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="LaundryPro Services"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                type="email"
                placeholder="business@example.com"
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
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
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
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="+1234567890"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Service Area
              </label>
              <input
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="City, State"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Bio / Tagline
              </label>
              <input
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="Fast, reliable, eco-friendly laundry service"
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                maxLength={200}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.bio.length}/200 characters
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="Tell customers about your service, experience, and what makes you stand out..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-medium text-white">Pricing Rates</label>
            <div className="space-y-2">
              {pricingRates.map((rate, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    placeholder="Item (e.g., Shirt)"
                    value={rate.item}
                    onChange={(e) => updateRate(idx, "item", e.target.value)}
                    required
                  />
                  <input
                    className="w-32 px-3 py-2 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    placeholder="Rate (Rs)"
                    inputMode="decimal"
                    value={rate.rate}
                    onChange={(e) => updateRate(idx, "rate", e.target.value)}
                    required
                  />
                  {pricingRates.length > 1 && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border border-gray-600 text-red-400 hover:bg-red-900/30 transition-all"
                      onClick={() => removePricingRow(idx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-600 text-sm text-purple-400 hover:bg-purple-900/30 transition-all"
                onClick={addPricingRow}
              >
                + Add Custom Item
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-medium text-white">Tags</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              placeholder="Type tags separated by comma (e.g., eco-friendly, same-day, pickup-available)"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              required
            />
            {form.tags && (
              <div className="flex flex-wrap gap-2">
                {form.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full bg-purple-900/50 text-purple-300 text-sm font-medium border border-purple-600"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border border-gray-600 rounded-xl p-6 bg-gray-700/50">
            <h3 className="font-semibold text-lg text-white">Verification</h3>

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
                        disabled={!form.email}
                      >
                        Send OTP
                      </button>
                    ) : (
                      <>
                        <input
                          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                          placeholder="Enter 6-digit code"
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value)}
                          maxLength={6}
                        />
                        <button
                          type="button"
                          className="px-4 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-all"
                          onClick={verifyEmail}
                        >
                          Verify
                        </button>
                      </>
                    )}
                  </div>
                )}
                {emailOtpSent &&
                  !emailVerified &&
                  process.env.NODE_ENV !== "production" && (
                    <p className="text-xs text-gray-400">
                      Dev code:{" "}
                      <span className="font-mono font-bold text-purple-400">
                        {emailOtpSent}
                      </span>
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
                        disabled={!form.phone}
                      >
                        Send OTP
                      </button>
                    ) : (
                      <>
                        <input
                          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                          placeholder="Enter 6-digit code"
                          value={phoneCode}
                          onChange={(e) => setPhoneCode(e.target.value)}
                          maxLength={6}
                        />
                        <button
                          type="button"
                          className="px-4 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-all"
                          onClick={verifyPhone}
                        >
                          Verify
                        </button>
                      </>
                    )}
                  </div>
                )}
                {phoneOtpSent &&
                  !phoneVerified &&
                  process.env.NODE_ENV !== "production" && (
                    <p className="text-xs text-gray-400">
                      Dev code:{" "}
                      <span className="font-mono font-bold text-purple-400">
                        {phoneOtpSent}
                      </span>
                    </p>
                  )}
              </div>
            </div>
          </div>

          <button
            disabled={loading || !emailVerified || !phoneVerified}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-2xl transform hover:-translate-y-0.5"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>
      </form>
    </main>
  );
}
