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

export default function SeekerSignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    username: "",
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

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setAddr<K extends keyof typeof form.address>(k: K, v: string) {
    setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));
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
    const { ok, data } = await postJSON("/api/signup/seeker", form);
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Sign up (Seeker)</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="px-3 py-2 rounded border"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="Username"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            type="password"
            placeholder="Password (min 8)"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="px-3 py-2 rounded border"
            placeholder="Address line"
            value={form.address.line1}
            onChange={(e) => setAddr("line1", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="City"
            value={form.address.city}
            onChange={(e) => setAddr("city", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="State"
            value={form.address.state}
            onChange={(e) => setAddr("state", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="Country"
            value={form.address.country}
            onChange={(e) => setAddr("country", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="Postal Code"
            value={form.address.postalCode}
            onChange={(e) => setAddr("postalCode", e.target.value)}
            required
          />
          <input
            className="px-3 py-2 rounded border"
            placeholder="Nearby landmark (optional)"
            value={form.address.landmark}
            onChange={(e) => setAddr("landmark", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="font-medium">Email verification</p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={sendEmailOtp}
                disabled={!form.email}
              >
                Send OTP
              </button>
              <input
                className="px-3 py-2 rounded border flex-1"
                placeholder="Enter code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
              />
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={verifyEmail}
                disabled={emailVerified}
              >
                Verify
              </button>
            </div>
            {emailOtpSent && process.env.NODE_ENV !== "production" && (
              <p className="text-xs text-muted-foreground">
                Dev code: {emailOtpSent}
              </p>
            )}
            {emailVerified && (
              <p className="text-xs text-green-600">Email verified</p>
            )}
          </div>
          <div>
            <p className="font-medium">Phone verification</p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={sendPhoneOtp}
                disabled={!form.phone}
              >
                Send OTP
              </button>
              <input
                className="px-3 py-2 rounded border flex-1"
                placeholder="Enter code"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
              />
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={verifyPhone}
                disabled={phoneVerified}
              >
                Verify
              </button>
            </div>
            {phoneOtpSent && process.env.NODE_ENV !== "production" && (
              <p className="text-xs text-muted-foreground">
                Dev code: {phoneOtpSent}
              </p>
            )}
            {phoneVerified && (
              <p className="text-xs text-green-600">Phone verified</p>
            )}
          </div>
        </div>

        <button
          disabled={loading || !emailVerified || !phoneVerified}
          className="w-full px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </main>
  );
}
