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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Admin Overview
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              Welcome back, here&apos;s what isn&apos;t happening today.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            System Online
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-card/80">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <p className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                Open Complaints
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {stats?.openComplaints ?? 0}
                </span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  -2% vs last week
                </span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-card/80">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <p className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                Escrow Balance
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  ₹{stats?.escrowBalance.toLocaleString("en-IN") ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-card/80">
            <div className="absolute inset-0 bg-linear-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <p className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                Active Providers
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {stats?.activeProviders ?? 0}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  92% utilization
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Areas */}
        <section className="grid gap-8 lg:grid-cols-3">
          {/* Revenue Panel */}
          <div className="lg:col-span-2 rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Revenue & Payouts
                </h2>
                <p className="text-sm text-muted-foreground">
                  Platform earnings overview
                </p>
              </div>
              <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-full">
                View Reports
              </button>
            </div>

            <div className="flex-1 min-h-[240px] flex items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/20">
              <div className="text-center space-y-3">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Total Revenue
                </p>
                <p className="text-5xl font-bold tracking-tighter text-foreground/90">
                  ₹{stats?.totalRevenue.toLocaleString("en-IN") ?? 0}
                </p>
                <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  <span>{stats?.totalOrders ?? 0} orders processed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Complaints Queue */}
          <div className="rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Attention Needed
                </h2>
                <p className="text-sm text-muted-foreground">Active disputes</p>
              </div>
              <button className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                View All
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-muted/20 border border-dashed border-border/50">
              {stats?.openComplaints === 0 ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-check"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="font-medium text-foreground">All Clear</p>
                  <p className="text-xs text-muted-foreground">
                    No active complaints requiring attention.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-destructive">
                    {stats?.openComplaints}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Resolution
                  </p>
                  <button className="mt-2 text-xs bg-destructive text-destructive-foreground px-4 py-2 rounded-full font-medium hover:bg-destructive/90 transition-colors">
                    Process Queue
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
