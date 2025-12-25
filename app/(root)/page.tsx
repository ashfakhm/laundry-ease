import Link from "next/link";

export default function Home() {
  return (
    <main
      className="min-h-screen bg-background"
      role="main"
      aria-label="LaundryEase marketing home"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-16 md:flex-row md:items-stretch">
        <section
          className="flex flex-1 flex-col justify-center gap-8"
          aria-labelledby="intro-title"
        >
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Upfront payments with 24‑hour escrow protection
          </div>
          <div className="space-y-4">
            <h1
              id="intro-title"
              className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
            >
              Laundry, handled{" "}
              <span className="text-emerald-600">end‑to‑end</span>.
            </h1>
            <p className="max-w-xl text-balance text-sm text-muted-foreground sm:text-base">
              LaundryEase connects busy seekers with trusted providers. Book
              pickups, approve invoices, and track every order with built‑in
              escrow and dispute resolution.
            </p>
          </div>
          <nav
            className="flex flex-wrap items-center gap-3"
            aria-label="Primary"
          >
            <Link
              href="/choose-role"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              Get started
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              Sign in
            </Link>
            <p className="w-full text-xs text-muted-foreground sm:w-auto">
              No subscription. Pay only for completed orders.
            </p>
          </nav>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-600">
                Seekers
              </p>
              <p className="mt-1 text-xs">
                Book pickups, approve invoices, and raise complaints from one
                dashboard.
              </p>
            </div>
            <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-600">
                Providers
              </p>
              <p className="mt-1 text-xs">
                Generate invoices, manage pricing, and confirm delivery via OTP.
              </p>
            </div>
            <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-600">
                Admins
              </p>
              <p className="mt-1 text-xs">
                Moderate disputes, control payouts, and monitor platform health.
              </p>
            </div>
          </div>
        </section>
        <aside
          className="flex flex-1 items-center justify-center"
          aria-labelledby="workflow-title"
        >
          <div className="relative h-full w-full max-w-md">
            <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-linear-to-br from-emerald-500/15 via-sky-500/10 to-emerald-600/15 blur-3xl" />
            <div className="relative h-full rounded-[2rem] border bg-card/80 p-5 shadow-xl backdrop-blur-sm">
              <header className="mb-4">
                <h2
                  id="workflow-title"
                  className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                >
                  How LaundryEase works
                </h2>
                <p className="mt-1 text-sm font-medium text-foreground">
                  A protected flow from pickup to payout.
                </p>
              </header>
              <ol className="space-y-3 text-xs">
                <li className="flex gap-3 rounded-xl border bg-background px-3 py-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-500/30">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      Seeker creates a booking
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Choose a provider, pickup slot, and address. The provider
                      accepts before anything is charged.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border bg-background px-3 py-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-500/30">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      Invoice, payment & escrow
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Provider shares an itemised invoice. You pay upfront via
                      Stripe, and funds sit safely in escrow.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border bg-background px-3 py-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-500/30">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      Delivery, OTP & dispute window
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Delivery is confirmed with OTP. After 24 hours, funds are
                      released unless you raise a complaint.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
