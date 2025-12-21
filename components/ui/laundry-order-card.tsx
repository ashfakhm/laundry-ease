"use client";

import { SpotlightCard } from "@/components/ui/spotlight-card";
import {
  LaundryStatusPill,
  type LaundryStatusKey,
} from "./laundry-status-pill";

export function LaundryOrderCardPlaceholder() {
  const status: LaundryStatusKey = "in_wash";

  return (
    <SpotlightCard className="rounded-2xl border bg-card/50 p-5 text-xs shadow-sm backdrop-blur-md">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
            Sample order
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5">#LE‑8829</p>
        </div>
        <LaundryStatusPill status={status} label="In wash" />
      </header>
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="text-[11px] text-muted-foreground font-medium">Items</span>
          <span className="font-semibold text-foreground">5 pieces</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">
            Estimated total
          </span>
          <span className="font-semibold text-foreground">₹240</span>
        </div>
        <div className="pt-2">
           <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full w-[60%] bg-primary animate-pulse" />
           </div>
           <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
             Washing in progress...
           </p>
        </div>
      </div>
    </SpotlightCard>
  );
}
