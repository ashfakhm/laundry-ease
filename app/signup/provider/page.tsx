"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { AppHeader } from "@/components/ui/app-header";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Store,
  Loader2,
  Plus,
  X,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { LAUNDRY_SERVICES } from "@/lib/constants";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { ImageUpload } from "@/components/ui/image-upload";

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

export default function ProviderSignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    businessName: "",
    bio: "",
    description: "",
    location: "",
    services: [] as string[],
    radius_km: "10",
    free_radius_km: "5",
    price_per_km: "0",
    pricing: "0",
    bankAccountHolder: "",
    bankAccountNumber: "",
    bankIFSC: "",
    upiId: "",
    profilePicture: "",
    bannerImage: "",
    coordinates: undefined as { lat: number; lng: number } | undefined,
  });

  // Client-side validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const [pricingRates, setPricingRates] = useState<
    { item: string; rate: string }[]
  >([
    { item: "Shirt", rate: "" },
    { item: "Pant", rate: "" },
    { item: "Bedsheet", rate: "" },
  ]);
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

  function set<K extends keyof typeof form>(
    k: K,
    v:
      | string
      | number
      | boolean
      | string[]
      | Record<string, number>
      | undefined,
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleService(service: string) {
    setForm((prev) => {
      const services = prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service];
      return { ...prev, services };
    });
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
      if (!ok) return setError(extractError(data, "Failed to send email OTP"));
      setEmailOtpSent("OTP sent to your email");
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
      if (!ok) return setError(extractError(data, "Invalid code"));
      setEmailVerified(true);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailVerified) return setError("Please verify your email address");

    // Validate email
    if (!form.email || !isValidEmail(form.email))
      return setError("Please enter a valid email address");

    // Validate password
    if (!isPasswordValid)
      return setError("Password does not meet all requirements");

    // Validate password confirmation
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match");

    // Validate bank details
    if (!form.bankAccountHolder || !form.bankAccountNumber || !form.bankIFSC) {
      return setError(
        "Bank account holder name, account number, and IFSC are required",
      );
    }

    setLoading(true);

    // Convert pricing rates array to object
    const ratesObj = pricingRates.reduce(
      (acc, { item, rate }) => {
        if (item && rate) {
          acc[item] = Number(rate) || 0;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const { ok, data } = await postJSON("/api/signup/provider", {
      name: form.name,
      email: form.email,
      password: form.password,
      phone: normalizePhone(form.phone),
      businessName: form.businessName,
      bio: form.bio,
      description: form.description,
      pricingRates: ratesObj,
      services: form.services,
      location: form.location,
      radius_km: Number(form.radius_km) || 10,
      free_radius_km: Number(form.free_radius_km) || 0,
      price_per_km: Number(form.price_per_km) || 0,
      pricing: Number(form.pricing) || 0,
      bankAccountHolder: form.bankAccountHolder,
      bankAccountNumber: form.bankAccountNumber,
      bankIFSC: form.bankIFSC,
      upiId: form.upiId,
      coordinates: form.coordinates,
    });
    setLoading(false);
    if (!ok) return setError(extractError(data, "Signup failed"));

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: true,
      callbackUrl: "/",
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
              <Briefcase className="w-4 h-4 text-primary" />
              <span>Partner with LaundryEase</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
                Grow your business as a{" "}
                <span className="text-primary">Provider</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Reach more customers, manage orders efficiently, and get paid
                securely. We handle the tech so you can focus on quality
                service.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              {[
                "Automated digital invoicing",
                "Set your own service radius & pricing",
                "Guaranteed payouts via Escrow",
                "Smart delivery tracking with OTP",
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
              {/* Account Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Account Credentials
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Login details for your business account.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Owner Name</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Your Full Name"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <input
                      type="email"
                      className={`flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        fieldErrors.email
                          ? "border-destructive"
                          : "border-input"
                      }`}
                      placeholder="business@example.com"
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
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="9876543210"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      We&apos;ll add +91 automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              {/* Business Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Business Profile
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This information will be visible to customers.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Business Name</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50">
                        <Store className="w-4 h-4" />
                      </span>
                      <input
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="e.g. Sparkle Clean Laundry"
                        value={form.businessName}
                        onChange={(e) => set("businessName", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">
                      Short Bio (Tagline)
                    </label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Fastest service in Indiranagar"
                      value={form.bio}
                      onChange={(e) => set("bio", e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">
                      Full Description
                    </label>
                    <textarea
                      className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Tell customers about your services, experience, and why they should choose you."
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  {/* Profile Picture & Banner */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <ImageUpload
                        label="Profile Picture"
                        value={form.profilePicture}
                        onChange={(val) => set("profilePicture", val)}
                        variant="profile"
                      />
                      <div className="md:col-span-2">
                        <ImageUpload
                          label="Banner Image"
                          value={form.bannerImage}
                          onChange={(val) => set("bannerImage", val)}
                          variant="banner"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These images will be displayed on your public profile to
                      attract customers.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Service Area (Location)
                    </label>
                    <LocationAutocomplete
                      value={form.location}
                      onChange={(address, coords) => {
                        set("location", address);
                        if (coords) {
                          set("coordinates", {
                            lat: coords.lat,
                            lng: coords.lng,
                          });
                        }
                      }}
                      placeholder="e.g. Koramangala"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Max Service Radius (km)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={form.radius_km}
                        onChange={(e) => set("radius_km", e.target.value)}
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                        km
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Free Delivery Radius (km)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={form.free_radius_km}
                        onChange={(e) => set("free_radius_km", e.target.value)}
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                        km
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Delivery Charge (after free radius)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs opacity-70">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-6 pr-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={form.price_per_km}
                        onChange={(e) => set("price_per_km", e.target.value)}
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                        / km
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              {/* Pricing & Services */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Services & Pricing
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Set your base Booking Price and item rates.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Booking Price (Minimum Fee)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs opacity-70">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      className="flex h-10 w-full rounded-lg border border-input bg-background pl-6 pr-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="e.g. 50"
                      value={form.pricing}
                      onChange={(e) => set("pricing", e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The starting price shown on your profile card.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Item Rates</p>
                  {pricingRates.map((rate, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        className="flex-2 h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Item (e.g. Shirt)"
                        value={rate.item}
                        onChange={(e) =>
                          updateRate(idx, "item", e.target.value)
                        }
                        required
                      />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs opacity-70">
                          ₹
                        </span>
                        <input
                          className="w-full h-10 rounded-lg border border-input bg-background pl-6 pr-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Rate"
                          inputMode="decimal"
                          value={rate.rate}
                          onChange={(e) =>
                            updateRate(idx, "rate", e.target.value)
                          }
                          required
                        />
                      </div>
                      {pricingRates.length > 1 && (
                        <button
                          type="button"
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-dashed border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => removePricingRow(idx)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPricingRow}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline px-1"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Services Offered
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {LAUNDRY_SERVICES.map((service) => {
                      const isSelected = form.services.includes(service);
                      return (
                        <div
                          key={service}
                          onClick={() => toggleService(service)}
                          className={cn(
                            "cursor-pointer flex items-center justify-between p-3 rounded-lg border transition-all",
                            isSelected
                              ? "bg-primary/5 border-primary shadow-sm"
                              : "bg-muted/20 border-border hover:border-primary/50",
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isSelected
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {service}
                          </span>
                          {isSelected && (
                            <div className="h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                              <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              {/* Payout Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Payout (Bank) Details
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Required to receive payouts. Details must match your bank
                    records.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Account Holder Name
                    </label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="As per bank records"
                      value={form.bankAccountHolder}
                      onChange={(e) => set("bankAccountHolder", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Account Number
                    </label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Bank account number"
                      value={form.bankAccountNumber}
                      onChange={(e) => set("bankAccountNumber", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IFSC Code</label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="e.g. HDFC0001234"
                      value={form.bankIFSC}
                      onChange={(e) =>
                        set("bankIFSC", e.target.value.toUpperCase())
                      }
                      required
                      maxLength={11}
                      pattern="^[A-Z]{4}0[A-Z0-9]{6}$"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      UPI ID (optional)
                    </label>
                    <input
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="yourname@upi (optional)"
                      value={form.upiId}
                      onChange={(e) => set("upiId", e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/50" />

              {/* Verification Section */}
              <div className="bg-secondary/30 rounded-xl p-6 border border-border/50 space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    Verify Email
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Verify your email to activate your provider profile.
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
                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !emailVerified}
                  className="w-full h-12 bg-primary text-primary-foreground font-bold text-base rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {loading
                    ? "Creating Business Account..."
                    : "Create Business Account"}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  By confirming, you agree to our Terms and Privacy Policy.
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </main>
    </>
  );
}
