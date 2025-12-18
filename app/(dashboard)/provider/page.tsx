export default function ProviderDashboardPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Provider dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              See today&apos;s pickups, deliveries, and invoices in one place.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Live · 0 active orders
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Pickups today
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Scheduled or accepted pickups scheduled for today.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Deliveries due
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Orders that should be delivered before midnight.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Awaiting payment
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Invoices sent but not yet paid by seekers.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Today&apos;s queue</h2>
            <p className="text-sm text-muted-foreground">
              Once you implement bookings and orders, list upcoming pickups and
              deliveries here as a Kanban or time‑sorted list.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Recent payouts</h2>
            <p className="text-sm text-muted-foreground">
              This is a placeholder for showing Stripe payouts and escrow
              releases, including any refunds due to complaints.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
