"use client";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/app-header";

export default function ChooseRole() {
  const router = useRouter();

  function choose(role: "seeker" | "provider") {
    if (role === "seeker") {
      router.push("/signup/seeker");
    } else {
      router.push("/signup/provider");
    }
  }

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-12 md:items-stretch">
          <header className="mb-10 text-center md:mb-12">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Step 0 · Choose how you use LaundryEase
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Are you booking laundry or providing it?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Pick the role that fits you best. You can always create a second
              account later if you run both sides of the marketplace.
            </p>
          </header>

          <section className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <button
              className="group flex flex-col justify-between rounded-3xl border bg-card/80 p-6 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md"
              onClick={() => choose("seeker")}
              type="button"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  For customers
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold">I am a Seeker</h2>
                  <p className="text-sm text-muted-foreground">
                    Request pickups, approve invoices, pay securely into escrow,
                    and track delivery with OTP confirmation.
                  </p>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <li>• Book one‑time or recurring pickups.</li>
                  <li>• View transparent pricing before you pay.</li>
                  <li>• Raise complaints with photo proof if needed.</li>
                </ul>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm font-medium text-emerald-600">
                <span>Continue as seeker</span>
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </button>

            <button
              className="group flex flex-col justify-between rounded-3xl border bg-card/80 p-6 text-left shadow-sm transition hover:border-sky-500 hover:shadow-md"
              onClick={() => choose("provider")}
              type="button"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  For service providers
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold">I am a Provider</h2>
                  <p className="text-sm text-muted-foreground">
                    Receive bookings, generate invoices, manage delivery radius
                    and pricing, and get paid after the escrow window.
                  </p>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <li>• Configure per‑item pricing and service areas.</li>
                  <li>• Use OTP to confirm each successful delivery.</li>
                  <li>• Track payouts and disputes in your dashboard.</li>
                </ul>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm font-medium text-sky-600">
                <span>Continue as provider</span>
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </button>
          </section>

          <footer className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/auth"
              className="font-medium text-emerald-600 hover:text-emerald-500"
            >
              Sign in
            </a>
          </footer>
        </div>
      </main>
    </>
  );
}
