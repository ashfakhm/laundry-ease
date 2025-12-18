"use client";

import { LaundryStatusPill } from "./laundry-status-pill";

const steps = [
  {
    id: 1,
    title: "Picked up",
    description: "Clothes collected and tagged for this order.",
    status: "requested" as const,
  },
  {
    id: 2,
    title: "In wash",
    description: "Sorting, washing and stain treatment in progress.",
    status: "in_wash" as const,
  },
  {
    id: 3,
    title: "Drying / ironing",
    description: "Tumble drying, steam or press as requested.",
    status: "drying" as const,
  },
  {
    id: 4,
    title: "Out for delivery",
    description: "Courier en route to your address.",
    status: "out_for_delivery" as const,
  },
  {
    id: 5,
    title: "Escrow window",
    description: "24 hours to raise a complaint before payout.",
    status: "delivered_escrow" as const,
  },
];

export function LaundryCycleSteps() {
  return (
    <ol className="space-y-3 text-xs">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex gap-3 rounded-2xl border bg-background px-3 py-2 shadow-xs"
        >
          <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/30">
            {step.id}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                {step.title}
              </p>
              <LaundryStatusPill status={step.status} label={step.title} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
