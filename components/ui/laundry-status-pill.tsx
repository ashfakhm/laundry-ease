"use client";

import type React from "react";

const statusColors = {
  requested: "bg-sky-500/10 text-sky-700 ring-sky-500/30",
  in_wash: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30",
  drying: "bg-amber-500/10 text-amber-700 ring-amber-500/30",
  out_for_delivery: "bg-violet-500/10 text-violet-700 ring-violet-500/30",
  delivered_escrow: "bg-emerald-600/10 text-emerald-700 ring-emerald-600/30",
} as const;

export type LaundryStatusKey = keyof typeof statusColors;

export function LaundryStatusPill({
  status,
  label,
}: {
  status: LaundryStatusKey;
  label: string;
}) {
  const color = statusColors[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
