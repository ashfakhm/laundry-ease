export default function SeekerDashboardPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Your laundry at a glance
            </h1>
            <p className="text-sm text-muted-foreground">
              Track pickups, deliveries, and invoices—all backed by escrow.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            No active orders
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Active orders
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Orders currently in washing, drying, or on the way.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Invoices to review
            </p>
            <p className="mt-2 text-2xl font-semibold">0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Invoices waiting for your approval and payment.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Outstanding fees
            </p>
            <p className="mt-2 text-2xl font-semibold">₹0</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cancellation fees that must be cleared before new bookings.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Next steps</h2>
            <p className="text-sm text-muted-foreground">
              Once you add bookings and orders, this area can show you a
              timeline of pickups, washing, delivery, and the 24‑hour escrow
              window.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
            <p className="text-sm text-muted-foreground">
              Use this card later to list your last few orders, complaints, and
              refunds so everything feels transparent.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
