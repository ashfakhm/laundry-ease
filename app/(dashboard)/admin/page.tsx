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

interface SystemAlertPreview {
  _id: string;
  key: string;
  message: string;
  severity: "critical" | "high";
  status: "open" | "resolved";
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  acknowledgedAt: string | null;
  owner: string | null;
  acknowledgedByEmail: string | null;
}

interface AdminStats {
  operationalHealth: {
    trend7d: Array<{
      date: string;
      opened: number;
      resolved: number;
    }>;
    openedLast24h: number;
    openedBaseline7d: number;
    baselineOpenedDailyAvg: number;
    burnRate: number;
    burnRateTier: "stable" | "watch" | "high" | "critical";
    mttrHours7d: number | null;
    resolvedCount7d: number;
  };
  criticalSystemAlerts: number;
  highSystemAlerts: number;
  systemAlertCount: number;
  unacknowledgedCriticalSystemAlerts: number;
  unacknowledgedHighSystemAlerts: number;
  unacknowledgedSystemAlertCount: number;
  activeComplaints: number;
  openComplaints: number;
  escrowBalance: number;
  activeProviders: number;
  totalProviders: number;
  providerUtilizationPct: number;
  totalOrders: number;
  totalRevenue: number;
  recentActiveComplaints: ActiveComplaintPreview[];
  recentSystemAlerts: SystemAlertPreview[];
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

function getBurnRateTone(tier: "stable" | "watch" | "high" | "critical") {
  if (tier === "critical") {
    return "bg-red-500/10 text-red-700 ring-red-500/20";
  }
  if (tier === "high") {
    return "bg-amber-500/10 text-amber-700 ring-amber-500/20";
  }
  if (tier === "watch") {
    return "bg-blue-500/10 text-blue-700 ring-blue-500/20";
  }
  return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20";
}

function getAlertSeverityTone(severity: "critical" | "high") {
  if (severity === "critical") {
    return "bg-red-500/10 text-red-700 border border-red-500/20";
  }
  return "bg-amber-500/10 text-amber-700 border border-amber-500/20";
}

function formatOwnerLabel(owner: string | null) {
  if (!owner) return "Unassigned";
  if (owner === "platform_admin_oncall") return "Platform Admin On-Call";
  if (owner === "backend_oncall") return "Backend On-Call";
  if (owner === "tech_lead") return "Tech Lead";
  return owner;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ackInFlight, setAckInFlight] = useState<string | null>(null);

  async function fetchStats(showLoader = false) {
    if (showLoader) {
      setLoading(true);
    }

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
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  async function acknowledgeAlert(alertId: string) {
    setAckInFlight(alertId);
    try {
      const response = await fetch(`/api/admin/system-alerts/${alertId}/acknowledge`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to acknowledge alert");
      }

      await fetchStats(false);
    } catch (error) {
      console.error("Failed to acknowledge system alert:", error);
    } finally {
      setAckInFlight(null);
    }
  }

  useEffect(() => {
    fetchStats(true);
  }, []);

  const activeComplaints = stats?.activeComplaints ?? 0;
  const criticalSystemAlerts = stats?.criticalSystemAlerts ?? 0;
  const highSystemAlerts = stats?.highSystemAlerts ?? 0;
  const systemAlertCount = stats?.systemAlertCount ?? 0;
  const unacknowledgedSystemAlertCount = stats?.unacknowledgedSystemAlertCount ?? 0;
  const totalProviders = stats?.totalProviders ?? 0;
  const utilizationPct = stats?.providerUtilizationPct ?? 0;
  const recentActiveComplaints = stats?.recentActiveComplaints ?? [];
  const recentSystemAlerts = stats?.recentSystemAlerts ?? [];
  const hasCriticalAlerts = criticalSystemAlerts > 0;
  const hasHighAlerts = highSystemAlerts > 0;
  const operationalHealth = stats?.operationalHealth;
  const trend7d = operationalHealth?.trend7d ?? [];
  const trendMax = Math.max(
    1,
    ...trend7d.map((point) => Math.max(point.opened, point.resolved)),
  );

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
        <section className="rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Operational Health
              </h2>
              <p className="text-sm text-muted-foreground">
                7-day alert trend, burn-rate, and recovery speed.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${getBurnRateTone(
                operationalHealth?.burnRateTier ?? "stable",
              )}`}
            >
              Burn Rate {(operationalHealth?.burnRate ?? 0).toFixed(2)}x (
              {(operationalHealth?.burnRateTier ?? "stable").toUpperCase()})
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Alerts Opened (24h)
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {operationalHealth?.openedLast24h ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Baseline avg/day:{" "}
                {(operationalHealth?.baselineOpenedDailyAvg ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                MTTR (7d)
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {operationalHealth?.mttrHours7d !== null &&
                operationalHealth?.mttrHours7d !== undefined
                  ? `${operationalHealth.mttrHours7d.toFixed(1)}h`
                  : "N/A"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {operationalHealth?.resolvedCount7d ?? 0} alerts resolved
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open Alerts Now
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {systemAlertCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {criticalSystemAlerts} critical, {highSystemAlerts} high
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Alert Trend (7d)
              </p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-red-500/80"></span>
                  Opened
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500/80"></span>
                  Resolved
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {trend7d.map((point) => {
                const openedHeight =
                  point.opened === 0
                    ? 0
                    : Math.max(6, Math.round((point.opened / trendMax) * 80));
                const resolvedHeight =
                  point.resolved === 0
                    ? 0
                    : Math.max(6, Math.round((point.resolved / trendMax) * 80));
                return (
                  <div key={point.date} className="space-y-1 text-center">
                    <div className="flex h-24 items-end justify-center gap-1 rounded-lg border border-border/40 bg-muted/20 px-1 py-2">
                      <span
                        className="w-2 rounded-sm bg-red-500/80"
                        style={{ height: `${openedHeight}px` }}
                        title={`${point.date}: ${point.opened} opened`}
                      />
                      <span
                        className="w-2 rounded-sm bg-emerald-500/80"
                        style={{ height: `${resolvedHeight}px` }}
                        title={`${point.date}: ${point.resolved} resolved`}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {point.date.slice(5)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-card/50 p-8 shadow-sm backdrop-blur-md flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Incident Ownership
              </h2>
              <p className="text-sm text-muted-foreground">
                Acknowledge and assign open critical/high alerts.
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                unacknowledgedSystemAlertCount > 0
                  ? "bg-red-500/10 text-red-700 ring-red-500/20"
                  : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
              }`}
            >
              {unacknowledgedSystemAlertCount} Unacknowledged
            </span>
          </div>

          {recentSystemAlerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-6 text-sm text-muted-foreground">
              No open critical/high system alerts.
            </div>
          ) : (
            <div className="grid gap-3">
              {recentSystemAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className="rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getAlertSeverityTone(
                            alert.severity,
                          )}`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {alert.key}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        First seen:{" "}
                        {alert.firstSeenAt
                          ? new Date(alert.firstSeenAt).toLocaleString()
                          : "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Owner: {formatOwnerLabel(alert.owner)}
                        {alert.acknowledgedByEmail
                          ? ` • Ack by ${alert.acknowledgedByEmail}`
                          : ""}
                      </p>
                    </div>
                    {alert.acknowledgedAt ? (
                      <span className="inline-flex h-fit items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                        Acknowledged{" "}
                        {new Date(alert.acknowledgedAt).toLocaleTimeString()}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => acknowledgeAlert(alert._id)}
                        disabled={ackInFlight === alert._id}
                        className="inline-flex h-fit items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-60"
                      >
                        {ackInFlight === alert._id ? "Acknowledging..." : "Acknowledge"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
