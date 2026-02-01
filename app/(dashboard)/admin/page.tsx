"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AdminStats {
  openComplaints: number;
  escrowBalance: number;
  activeProviders: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/dashboard-stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Admin Overview
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor complaints, payouts, and platform‑wide health at a glance.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Escrow engine · Online
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground">
              Open Complaints
            </p>
            <p className="mt-2 text-3xl font-bold">
              {stats?.openComplaints ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              New complaints raised in last 24h
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground">
              Held in Escrow
            </p>
            <p className="mt-2 text-3xl font-bold">
              ₹{stats?.escrowBalance.toLocaleString("en-IN") ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Funds held in active orders
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md">
            <p className="text-xs font-medium text-muted-foreground">
              Providers Online
            </p>
            <p className="mt-2 text-3xl font-bold">
              {stats?.activeProviders ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Active providers in last 7 days
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Escrow & Payout Timeline
              </h2>
              <button className="text-xs font-medium text-emerald-600 hover:text-emerald-500">
                View Ledger
              </button>
            </div>
            <div className="flex h-50 items-center justify-center rounded-2xl border border-dashed bg-muted/30">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold">
                  ₹{stats?.totalRevenue.toLocaleString("en-IN") ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalOrders ?? 0} total orders
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Complaints & Disputes</h2>
              <button className="text-xs font-medium text-emerald-600 hover:text-emerald-500">
                Resolve All
              </button>
            </div>
            <div className="flex h-50 items-center justify-center rounded-2xl border border-dashed bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {stats?.openComplaints === 0
                  ? "No active disputes"
                  : `${stats?.openComplaints} open complaint${
                      stats?.openComplaints !== 1 ? "s" : ""
                    }`}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
