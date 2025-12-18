export default function AdminDashboardPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Admin overview
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor complaints, payouts, and platform‑wide health at a glance.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Escrow engine · online
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Open complaints
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              New complaints raised in the last 24 hours.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Held in escrow
            </p>
            <p className="mt-2 text-2xl font-semibold">₹0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Funds currently held due to active orders and disputes.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Providers online
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Providers who accepted at least one order today.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">
              Escrow & payout timeline
            </h2>
            <p className="text-sm text-muted-foreground">
              As you build the system, this card can show upcoming escrow
              releases and manual review queues. For now, it&apos;s a visual
              placeholder.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">
              Complaints & disputes
            </h2>
            <p className="text-sm text-muted-foreground">
              Surface complaints by severity and ageing here so admins can act
              quickly on stuck orders.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
