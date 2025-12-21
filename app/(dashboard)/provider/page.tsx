export default function ProviderDashboardPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Provider Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your laundry business, track orders, and view earnings.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live · 0 active orders
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground">
              Pickups Today
            </p>
            <p className="mt-2 text-3xl font-bold">0</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Scheduled pickups for today
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground">
              Deliveries Due
            </p>
            <p className="mt-2 text-3xl font-bold">0</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Orders due before midnight
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground">
              Pending Payments
            </p>
            <p className="mt-2 text-3xl font-bold">0</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Invoices awaiting payment
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Today&apos;s Queue</h2>
              <button className="text-xs font-medium text-emerald-600 hover:text-emerald-500">
                View All
              </button>
            </div>
            <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed bg-muted/30">
              <p className="text-sm text-muted-foreground">
                No active tasks right now
              </p>
            </div>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Payouts</h2>
              <button className="text-xs font-medium text-emerald-600 hover:text-emerald-500">
                View History
              </button>
            </div>
            <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed bg-muted/30">
              <p className="text-sm text-muted-foreground">
                No recent transactions
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
