"use client";

import {
  LaundryStatusPill,
  type LaundryStatusKey,
} from "./laundry-status-pill";

export function LaundryOrderCardPlaceholder() {
  const status: LaundryStatusKey = "in_wash";

  return (
    <article className="rounded-2xl border bg-card p-4 text-xs shadow-sm">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Sample order
          </p>
          <p className="text-sm font-semibold text-foreground">#LE‑0000</p>
        </div>
        <LaundryStatusPill status={status} label="In wash" />
      </header>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Items</span>
          <span className="font-medium text-foreground">5 pieces</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Estimated total
          </span>
          <span className="font-medium text-foreground">₹0</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Once real data is wired, this card will show your live order details
          and status.
        </p>
      </div>
    </article>
  );
}
