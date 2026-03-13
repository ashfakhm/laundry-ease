"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { signIn } from "next-auth/react";
import { AppHeader } from "@/components/ui/app-header";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Loader2, Phone, Mail } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

async function postJSON(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as const;
}

/** Extract a human-readable error string from the standardised API envelope. */
function extractError(data: Record<string, unknown>, fallback: string): string {
  // API returns { error: { code, message }, message }
  const err = data?.error;
  if (typeof err === "string") return err;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  if (typeof data?.message === "string" && data.message) return data.message;
  return fallback;
}

export default function SeekerSignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: {
      line1: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      landmark: "",
    },
    coordinates: undefined as { lat: number; lng: number } | undefined,
  });

  // Client-side validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Email validation
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Password validation helpers
  const passwordChecks = {
    minLength: form.password.length >= 8,
    hasUppercase: /[A-Z]/.test(form.password),
    hasNumber: /[0-9]/.test(form.password),
    hasSpecial: /[^A-Za-z0-9]/.test(form.password),
  };
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch =
    form.password === form.confirmPassword && form.confirmPassword.length > 0;

  // Validate field on blur
  function validateField(field: string, value: string) {
    const errors = { ...fieldErrors };
    switch (field) {
      case "email":
        if (value && !isValidEmail(value)) {
          errors.email = "Please enter a valid email address";
        } else {
          delete errors.email;
        }
        break;
      case "confirmPassword":
        if (value && value !== form.password) {
          errors.confirmPassword = "Passwords do not match";
        } else {
          delete errors.confirmPassword;
        }
        break;
    }
    setFieldErrors(errors);
  }
  const [emailOtpSent, setEmailOtpSent] = useState<string | null>(null);

  const [emailCode, setEmailCode] = useState("");

  const [emailVerified, setEmailVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSending, startEmailSend] = useTransition();

  const [emailVerifying, startEmailVerify] = useTransition();

  // Normalize phone to E.164
  function normalizePhone(input: string) {
    const raw = (input || "").trim();
    if (!raw) return "";
    if (raw.startsWith("+")) return raw;
    const digits = raw.replace(/\D+/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
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
      if (!ok) return setError(extractError(data, "Failed to send email OTP"));
      setEmailOtpSent("OTP sent to your email");
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
      if (!ok) return setError(extractError(data, "Invalid code"));
      setEmailVerified(true);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Validate all required fields before submit
    if (!form.name || form.name.length < 2)
      return setError("Name must be at least 2 characters");
    if (!form.email || !isValidEmail(form.email))
      return setError("Enter a valid email address");
    if (!isPasswordValid)
      return setError("Password does not meet all requirements");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match");
    if (!form.phone || !/^\+?[1-9]\d{9,14}$/.test(normalizePhone(form.phone)))
      return setError("Enter a valid phone number");
    const addr = form.address;
    if (
      !addr.line1 ||
      !addr.city ||
      !addr.state ||
      !addr.country ||
      !addr.postalCode
    )
      return setError("All address fields are required");
    if (!emailVerified) return setError("Please verify your email address");
    if (!acceptedTerms)
      return setError("Please agree to the Seeker Terms and Conditions");
    setLoading(true);
    const { ok, data } = await postJSON("/api/signup/seeker", {
      ...form,
      phone: normalizePhone(form.phone),
      coordinates: form.coordinates,
      acceptTerms: acceptedTerms,
    });
    setLoading(false);
    if (!ok) {
      if (data?.details?.fieldErrors) {
        const first = Object.values(data.details.fieldErrors)[0];
        if (Array.isArray(first) && first.length > 0) return setError(first[0]);
      }
      return setError(extractError(data, "Signup failed"));
    }
    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: true,
      callbackUrl: "/seeker",
    });
  }

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto flex min-h-[calc(100vh-100px)] w-full max-w-6xl flex-col gap-12 md:flex-row items-start">
          {/* Left Rail */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 space-y-8 sticky top-24 pt-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground border border-border/50 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Verified Seeker Account</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
                Join LaundryEase as a{" "}
                <span className="text-primary">Seeker</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Create one account to manage all your laundry needs. Reliable
                providers, transparent pricing and guaranteed deadlines.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              {[
                "Bank-grade escrow payment protection",
                "Verified providers with real reviews",
                "One-click repeat bookings",
              ].map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  {benefit}
                </div>
              ))}
            </div>
          </motion.section>

          {/* Right Rail - Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-[1.5] w-full"
          >
            <form
              onSubmit={submit}
              className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl shadow-primary/5 p-6 md:p-8 space-y-8"
            >
              {/* Personal Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Personal Details
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your basic account information.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                      placeholder="Enter Your Name"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <input
                      type="email"
                      className={`flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
                        fieldErrors.email
                          ? "border-destructive"
                          : "border-input"
                      }`}
                      placeholder="Enter Your Email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={(e) => validateField("email", e.target.value)}
                      required
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-destructive">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <PasswordInput
                      id="password"
                      label="Password"
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      required
                    />
                    {form.password && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div
                          className={`text-xs flex items-center gap-1 ${passwordChecks.minLength ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          <CheckCircle2
                            className={`w-3 h-3 ${passwordChecks.minLength ? "" : "opacity-30"}`}
                          />
                          8+ characters
                        </div>
                        <div
                          className={`text-xs flex items-center gap-1 ${passwordChecks.hasUppercase ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          <CheckCircle2
                            className={`w-3 h-3 ${passwordChecks.hasUppercase ? "" : "opacity-30"}`}
                          />
                          Uppercase letter
                        </div>
                        <div
                          className={`text-xs flex items-center gap-1 ${passwordChecks.hasNumber ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          <CheckCircle2
                            className={`w-3 h-3 ${passwordChecks.hasNumber ? "" : "opacity-30"}`}
                          />
                          Number
                        </div>
                        <div
                          className={`text-xs flex items-center gap-1 ${passwordChecks.hasSpecial ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          <CheckCircle2
                            className={`w-3 h-3 ${passwordChecks.hasSpecial ? "" : "opacity-30"}`}
                          />
                          Special character
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <PasswordInput
                      id="confirmPassword"
                      label="Confirm Password"
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                      onBlur={(e) =>
                        validateField("confirmPassword", e.target.value)
                      }
                      required
                    />
                    {form.confirmPassword && (
                      <p
                        className={`text-xs flex items-center gap-1 ${passwordsMatch ? "text-green-600" : "text-destructive"}`}
                      >
                        <CheckCircle2
                          className={`w-3 h-3 ${passwordsMatch ? "" : "opacity-30"}`}
                        />
                        {passwordsMatch
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                        placeholder="9876543210"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      We&apos;ll add +91 automatically for Indian numbers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              {/* Address */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Default Address
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Where should we pick up your laundry?
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">
                      Street Address
                    </label>
                    <LocationAutocomplete
                      value={form.address.line1}
                      onChange={(address, coords) => {
                        setAddr("line1", address);
                        if (coords) {
                          setForm((prev) => ({
                            ...prev,
                            coordinates: { lat: coords.lat, lng: coords.lng },
                            address: {
                              ...prev.address,
                              line1: address,
                              city: coords.city || prev.address.city,
                              postalCode:
                                coords.pincode || prev.address.postalCode,
                            },
                          }));
                        }
                      }}
                      placeholder="Start typing your address..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Landmark (optional)
                    </label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Near park, school, etc. (optional)"
                      value={form.address.landmark || ""}
                      onChange={(e) => setAddr("landmark", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={form.address.city}
                      onChange={(e) => setAddr("city", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={form.address.state}
                      onChange={(e) => setAddr("state", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={form.address.country}
                      onChange={(e) => setAddr("country", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Postal Code</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={form.address.postalCode}
                      onChange={(e) => setAddr("postalCode", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              {/* Verification Section */}
              <div className="bg-secondary/30 rounded-xl p-6 border border-border/50 space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Verify Identity
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Verify your email to ensure platform safety.
                  </p>
                </div>

                <div>
                  {/* Email Verify */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" /> Email
                      </label>
                      {emailVerified && (
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    {!emailVerified && (
                      <div className="flex gap-2">
                        {!emailOtpSent ? (
                          <button
                            type="button"
                            onClick={sendEmailOtp}
                            disabled={!form.email || emailSending}
                            className="flex-1 h-10 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                          >
                            {emailSending ? "Sending..." : "Send Code"}
                          </button>
                        ) : (
                          <>
                            <input
                              className="flex-1 h-10 rounded-lg border border-input px-3 text-xs bg-background"
                              placeholder="XXXXXX"
                              maxLength={6}
                              value={emailCode}
                              onChange={(e) => setEmailCode(e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={verifyEmail}
                              disabled={emailVerifying}
                              className="px-4 h-10 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                            >
                              Verify
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {emailOtpSent && !emailVerified && (
                      <p className="text-[10px] text-green-600 font-medium">
                        OTP Sent to {form.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Seeker Terms and Conditions
                  </p>
                  <ul className="max-h-32 overflow-y-auto space-y-2 pr-2 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                    <li>
                      You must provide accurate account details and keep your
                      phone and email active for booking and delivery updates.
                    </li>
                    <li>
                      Booking requests become binding once a provider accepts,
                      and cancellations may attract platform charges based on
                      policy.
                    </li>
                    <li>
                      Payments are processed through LaundryEase escrow, and you
                      agree to release payment only after service completion or
                      valid dispute resolution.
                    </li>
                    <li>
                      You agree to treat provider staff respectfully and keep
                      pickup/drop locations safe and accessible.
                    </li>
                    <li>
                      Misuse, fraudulent claims, or abuse of offers can lead to
                      account suspension or permanent removal.
                    </li>
                  </ul>
                  <label className="flex items-start gap-2 text-xs text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                    />
                    <span>
                      I have read and agree to the{" "}
                      <Link
                        href="/terms/seeker"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        Seeker Terms and Conditions
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !emailVerified || !acceptedTerms}
                  className="w-full h-12 bg-primary text-primary-foreground font-bold text-base rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </main>
    </>
  );
}
