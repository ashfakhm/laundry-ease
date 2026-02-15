"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface ActiveComplaintPreview {
  _id: string;
  title: string | null;
  status: "open" | "accepted" | "in_review" | "resolved" | "rejected" | string;
  createdAt: string | null;
  seekerName: string;
  providerName: string;
}

interface AdminStats {
  criticalSystemAlerts: number;
  highSystemAlerts: number;
  systemAlertCount: number;
  activeComplaints: number;
  openComplaints: number;
  escrowBalance: number;
  activeProviders: number;
  totalProviders: number;
  providerUtilizationPct: number;
  totalOrders: number;
  totalRevenue: number;
  recentActiveComplaints: ActiveComplaintPreview[];
}

function getComplaintStatusLabel(status: string) {
  if (status === "in_review") return "In Review";
  if (status === "accepted") return "Accepted";
  if (status === "open") return "Open";
  return status;
}

function getComplaintStatusTone(status: string) {
  if (status === "open") {
    return "bg-red-500/10 text-red-600 border border-red-500/20";
  }
  if (status === "accepted") {
    return "bg-blue-500/10 text-blue-600 border border-blue-500/20";
  }
  if (status === "in_review") {
    return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
  }
  return "bg-muted text-muted-foreground border border-border";
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/dashboard-stats", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          setLoadError(null);
        } else {
          setStats(null);
          setLoadError("Unable to load live admin metrics.");
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
        setStats(null);
        setLoadError("Unable to load live admin metrics.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const activeComplaints = stats?.activeComplaints ?? 0;
  const criticalSystemAlerts = stats?.criticalSystemAlerts ?? 0;
  const highSystemAlerts = stats?.highSystemAlerts ?? 0;
  const systemAlertCount = stats?.systemAlertCount ?? 0;
  const totalProviders = stats?.totalProviders ?? 0;
  const utilizationPct = stats?.providerUtilizationPct ?? 0;
  const recentActiveComplaints = stats?.recentActiveComplaints ?? [];
  const hasCriticalAlerts = criticalSystemAlerts > 0;
  const hasHighAlerts = highSystemAlerts > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-bold text-foreground">Admin Overview</h1>
          <p className="text-sm text-muted-foreground">
            {loadError || "Unable to load live admin metrics."}
          </p>
        </div>
      </main>
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
              Live platform metrics, payouts, and dispute activity.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 shadow-sm backdrop-blur-sm ${
              hasCriticalAlerts
                ? "bg-red-500/10 text-red-700 ring-red-500/20"
                : hasHighAlerts
                  ? "bg-amber-500/10 text-amber-700 ring-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  hasCriticalAlerts
                    ? "bg-red-400"
                    : hasHighAlerts
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  hasCriticalAlerts
                    ? "bg-red-500"
                    : hasHighAlerts
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              ></span>
            </span>
            {hasCriticalAlerts
              ? `${criticalSystemAlerts} Critical Alert${
                  criticalSystemAlerts === 1 ? "" : "s"
                }`
              : hasHighAlerts
                ? `${systemAlertCount} Open Alert${
                    systemAlertCount === 1 ? "" : "s"
                  }`
                : "System Online"}
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-card/80">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <p className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                Active Complaints
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {activeComplaints}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Includes open, accepted, and in-review disputes
              </p>
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
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {totalProviders > 0
                  ? `${utilizationPct}% of ${totalProviders} providers active in last 7 days`
                  : "No providers onboarded yet"}
              </p>
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
              <Link
                href="/admin/payment-management"
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-full"
              >
                View Reports
              </Link>
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
              <Link
                href="/admin/complaints"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                View All
              </Link>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-muted/20 border border-dashed border-border/50">
              {activeComplaints === 0 ? (
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
                <div className="w-full space-y-3 text-left">
                  {recentActiveComplaints.map((complaint) => (
                    <Link
                      key={complaint._id}
                      href={`/admin/complaints/${complaint._id}`}
                      className="block rounded-xl border border-border/60 bg-background/70 p-3 hover:bg-background transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {complaint.title || "Complaint"}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {complaint.seekerName} vs {complaint.providerName}
                          </p>
                          {complaint.createdAt && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {new Date(complaint.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getComplaintStatusTone(
                            complaint.status,
                          )}`}
                        >
                          {getComplaintStatusLabel(complaint.status)}
                        </span>
                      </div>
                    </Link>
                  ))}

                  {activeComplaints > recentActiveComplaints.length && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{activeComplaints - recentActiveComplaints.length} more
                      active complaints
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
