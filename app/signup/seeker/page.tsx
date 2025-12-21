"use client";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { AppHeader } from "@/components/ui/app-header";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Loader2, Plus, X, Store, Info, Phone, Mail } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

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
      if (!ok) return setError(data?.error || "Invalid code");
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
      if (!ok) return setError(data?.error || "Invalid code");
      setPhoneVerified(true);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailVerified || !phoneVerified)
      return setError("Please verify both email and phone number");
    setLoading(true);
    const { ok, data } = await postJSON("/api/signup/seeker", {
      ...form,
      phone: normalizePhone(form.phone),
    });
    setLoading(false);
    if (!ok) return setError(data?.error || "Signup failed");
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
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Verified Seeker Account</span>
            </div>
            
            <div className="space-y-4">
               <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
                Join LaundryEase as a <span className="text-primary">Seeker</span>
               </h1>
               <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                 Create one account to manage all your laundry needs. Reliable providers, transparent pricing and guaranteed deadlines.
               </p>
            </div>

            <div className="space-y-4 pt-4">
               {[
                 "Bank-grade escrow payment protection",
                 "Verified providers with real reviews",
                 "One-click repeat bookings"
               ].map((benefit, i) => (
                 <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
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
             <form onSubmit={submit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl shadow-primary/5 p-6 md:p-8 space-y-8">
                
                {/* Personal Details */}
                <div className="space-y-6">
                   <div>
                     <h3 className="font-heading text-lg font-bold">Personal Details</h3>
                     <p className="text-sm text-muted-foreground">Your basic account information.</p>
                   </div>
                   
                   <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Full Name</label>
                        <input
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                          placeholder="John Doe"
                          value={form.name}
                          onChange={(e) => set("name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <input
                           type="email"
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                          placeholder="john@example.com"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                         <PasswordInput
                           id="password"
                           placeholder="Create a strong password"
                           value={form.password}
                           onChange={(e) => set("password", e.target.value)}
                           required
                         />
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
                        <p className="text-[11px] text-muted-foreground">We'll add +91 automatically for Indian numbers.</p>
                      </div>
                   </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Address */}
                <div className="space-y-6">
                   <div>
                     <h3 className="font-heading text-lg font-bold">Default Address</h3>
                     <p className="text-sm text-muted-foreground">Where should we pick up your laundry?</p>
                   </div>
                   
                   <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-2">
                         <label className="text-sm font-medium">Street Address</label>
                         <input
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Flat No, Building, Street"
                          value={form.address.line1}
                          onChange={(e) => setAddr("line1", e.target.value)}
                          required
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
                     <h3 className="font-heading text-lg font-bold">Verify Identity</h3>
                     <p className="text-sm text-muted-foreground">Required to ensure platform safety.</p>
                   </div>

                   <div className="grid md:grid-cols-2 gap-6">
                      {/* Email Verify */}
                      <div className="space-y-3">
                         <div className="flex justify-between items-center">
                            <label className="text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> Email</label>
                            {emailVerified && <span className="text-xs font-bold text-primary flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>}
                         </div>
                         {!emailVerified && (
                           <div className="flex gap-2">
                             {!emailOtpSent ? (
                               <button 
                                 type="button" 
                                 onClick={sendEmailOtp} disabled={!form.email || emailSending}
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
                                   onChange={e => setEmailCode(e.target.value)}
                                 />
                                 <button 
                                   type="button" 
                                   onClick={verifyEmail} disabled={emailVerifying}
                                   className="px-4 h-10 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                 >
                                   Verify
                                 </button>
                               </>
                             )}
                           </div>
                         )}
                         {emailOtpSent && !emailVerified && <p className="text-[10px] text-green-600 font-medium">OTP Sent to {form.email}</p>}
                      </div>

                      {/* Phone Verify */}
                      <div className="space-y-3">
                         <div className="flex justify-between items-center">
                            <label className="text-sm font-medium flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> Phone</label>
                            {phoneVerified && <span className="text-xs font-bold text-primary flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>}
                         </div>
                         {!phoneVerified && (
                           <div className="flex gap-2">
                             {!phoneOtpSent ? (
                               <button 
                                 type="button" 
                                 onClick={sendPhoneOtp} disabled={!form.phone || phoneSending}
                                 className="flex-1 h-10 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                               >
                                 {phoneSending ? "Sending..." : "Send Code"}
                               </button>
                             ) : (
                               <>
                                 <input 
                                   className="flex-1 h-10 rounded-lg border border-input px-3 text-xs bg-background"
                                   placeholder="XXXXXX"
                                   maxLength={6}
                                   value={phoneCode}
                                   onChange={e => setPhoneCode(e.target.value)}
                                 />
                                 <button 
                                   type="button" 
                                   onClick={verifyPhone} disabled={phoneVerifying}
                                   className="px-4 h-10 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                 >
                                   Verify
                                 </button>
                               </>
                             )}
                           </div>
                         )}
                          {phoneOtpSent && !phoneVerified && <p className="text-[10px] text-green-600 font-medium">OTP Sent to {form.phone}</p>}
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
                    disabled={loading || !emailVerified || !phoneVerified}
                    className="w-full h-12 bg-primary text-primary-foreground font-bold text-base rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                  >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {loading ? "Creating Account..." : "Create Account"}
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
