"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, CheckCircle, Ban } from "lucide-react";
import Link from "next/link";
import ComplaintChat from "@/components/complaint-chat";
import { showToast } from "@/lib/toast";

type Params = Promise<{ id: string }>;

interface ComplaintData {
  _id: string;
  order_id: string;
  title: string;
  description: string;
  complaint_type: string;
  status: string;
  createdAt: string;
  response_deadline?: string;
  provider_access_granted?: boolean;
  seeker?: {
    name?: string;
  } | null;
  provider?: {
    name?: string;
    businessName?: string | null;
  } | null;
  settlement_window?: {
    total_amount: number;
    distributable_amount: number;
    platform_commission: number;
    default_provider_payout: number;
  } | null;
}

type ResolveOutcome =
  | "release_payout"
  | "refund_full"
  | "refund_partial"
  | "reject";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatInr(value: number): string {
  return `INR ${round2(value).toFixed(2)}`;
}

function getProviderDisplayName(
  provider?: {
    name?: string;
    businessName?: string | null;
  } | null,
): string {
  const name = provider?.name?.trim();
  const businessName = provider?.businessName?.trim();

  if (
    name &&
    businessName &&
    name.toLowerCase() !== businessName.toLowerCase()
  ) {
    return `${name} (${businessName})`;
  }

  return name || businessName || "Provider";
}

export default function AdminComplaintDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [complaint, setComplaint] = useState<ComplaintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [seekerRefundAmount, setSeekerRefundAmount] = useState(0);

  const fetchComplaint = useCallback(async () => {
    try {
      const res = await fetch(`/api/complaints/${id}`);
      if (res.ok) {
        const data = await res.json();
        setComplaint(data);
        setSeekerRefundAmount(0);
      } else {
        showToast.error("Failed to load complaint");
      }
    } catch (error) {
      console.error("Error fetching complaint:", error);
      showToast.error("Failed to load complaint");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchComplaint();
  }, [fetchComplaint]);

  async function handleAddProvider() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/complaints/${id}/add-provider`, {
        method: "POST",
      });

      if (res.ok) {
        showToast.success("Provider added to conversation");
        fetchComplaint(); // Refresh
      } else {
        const data = await res.json();
        showToast.error(getApiErrorMessage(data, "Failed to add provider"));
      }
    } catch (error) {
      console.error("Error adding provider:", error);
      showToast.error("Failed to add provider");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve(
    outcome: ResolveOutcome,
    seekerRefundOverride?: number,
  ) {
    if (!confirm(`Are you sure you want to ${outcome.replace(/_/g, " ")}?`))
      return;

    setActionLoading(true);
    try {
      const payload: {
        outcome: ResolveOutcome;
        seeker_refund_amount?: number;
      } = {
        outcome,
      };
      if (typeof seekerRefundOverride === "number") {
        payload.seeker_refund_amount = round2(seekerRefundOverride);
      }

      const res = await fetch(`/api/admin/complaints/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        const settlement = data?.settlement;
        if (settlement) {
          showToast.success(
            `Complaint finalized. Seeker ${formatInr(Number(settlement.seeker_refund_amount || 0))}, Provider ${formatInr(Number(settlement.provider_payout_amount || 0))}.`,
          );
        } else {
          showToast.success("Complaint resolved successfully");
        }
        if (data?.payoutPendingManual || data?.refundPendingManual) {
          const parts: string[] = [];
          if (data?.payoutPendingManual) {
            parts.push(
              `Provider payout of ${formatInr(Number(settlement?.provider_payout_amount || 0))}`,
            );
          }
          if (data?.refundPendingManual) {
            parts.push(
              `Seeker refund of ${formatInr(Number(settlement?.seeker_refund_amount || 0))}`,
            );
          }
          showToast.error(
            `⚠️ ${parts.join(" and ")} requires manual transfer (UPI/bank).`,
          );
        }
        router.push("/admin/complaints");
      } else {
        showToast.error(
          getApiErrorMessage(data, "Failed to resolve complaint"),
        );
      }
    } catch (error) {
      console.error("Error resolving complaint:", error);
      showToast.error("Failed to resolve complaint");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApplySettlement() {
    if (distributableAmount <= 0) {
      showToast.error("No distributable amount available for settlement.");
      return;
    }

    if (clampedSeekerRefund <= 0.01) {
      await handleResolve("release_payout");
      return;
    }

    if (Math.abs(clampedSeekerRefund - distributableAmount) <= 0.01) {
      await handleResolve("refund_full");
      return;
    }

    await handleResolve("refund_partial", clampedSeekerRefund);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading complaint...
          </p>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Complaint not found</p>
          <Link
            href="/admin/complaints"
            className="mt-4 inline-block text-primary hover:underline"
          >
            Back to complaints
          </Link>
        </div>
      </div>
    );
  }

  const isResolved =
    complaint.status === "resolved" || complaint.status === "rejected";
  const providerAdded = complaint.provider_access_granted;
  const seekerLabel = complaint.seeker?.name?.trim() || "Seeker";
  const providerLabel = getProviderDisplayName(complaint.provider);
  const distributableAmount = round2(
    Number(complaint.settlement_window?.distributable_amount || 0),
  );
  const platformCommission = round2(
    Number(complaint.settlement_window?.platform_commission || 0),
  );
  const clampedSeekerRefund =
    distributableAmount <= 0
      ? 0
      : round2(Math.min(Math.max(0, seekerRefundAmount), distributableAmount));
  const providerPayoutAmount = round2(
    Math.max(0, distributableAmount - clampedSeekerRefund),
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/complaints"
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              Complaint #{complaint._id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground">
              Order: #{complaint.order_id.slice(-6)}
            </p>
          </div>
          <StatusBadge status={complaint.status} />
        </div>

        {/* Complaint Info Card */}
        <div className="bg-card rounded-2xl border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold">{complaint.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {complaint.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Type
              </p>
              <p className="text-sm font-medium mt-1">
                {complaint.complaint_type.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Created
              </p>
              <p className="text-sm font-medium mt-1">
                {new Date(complaint.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isResolved && (
          <div className="bg-card rounded-2xl border p-6 space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
              Admin Actions
            </h3>

            {/* Current Status Display */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm">
              <span className="text-muted-foreground">Current Status: </span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                {complaint.status}
              </span>
            </div>

            {/* Deadline Display */}
            {complaint.response_deadline && (
              <div className="p-3 rounded-xl bg-muted/50 text-sm">
                <span className="text-muted-foreground">
                  Response Deadline:{" "}
                </span>
                <span className="font-medium">
                  {new Date(complaint.response_deadline).toLocaleDateString()}
                </span>
                {new Date(complaint.response_deadline) < new Date() && (
                  <span className="ml-2 text-red-500 font-medium">
                    (Overdue)
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {/* Accept button for open complaints OR any non-standard status */}
              {(complaint.status === "open" ||
                ![
                  "open",
                  "accepted",
                  "in_review",
                  "resolved",
                  "rejected",
                ].includes(complaint.status)) && (
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const res = await fetch(
                        `/api/admin/complaints/${id}/accept`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ deadlineDays: 7 }),
                        },
                      );
                      if (res.ok) {
                        showToast.success("Complaint accepted");
                        fetchComplaint();
                      } else {
                        const data = await res.json();
                        showToast.error(
                          data.error?.message || "Failed to accept",
                        );
                      }
                    } catch {
                      showToast.error("Failed to accept complaint");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept Complaint
                </button>
              )}

              {/* Add Provider button - show for accepted status OR in_review without provider */}
              {!providerAdded &&
                (complaint.status === "accepted" ||
                  complaint.status === "in_review") && (
                  <button
                    onClick={handleAddProvider}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Provider to Chat
                  </button>
                )}

              {/* Resolution buttons - show for accepted, in_review, OR unknown status */}
              {(complaint.status === "accepted" ||
                complaint.status === "in_review" ||
                !["open", "resolved", "rejected"].includes(
                  complaint.status,
                )) && (
                <>
                  <div className="w-full rounded-xl border border-border/70 bg-muted/20 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        Settlement split (post-commission)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Commission retained: {formatInr(platformCommission)}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Seeker Refund
                        </p>
                        <p className="text-base font-semibold text-red-600">
                          {formatInr(clampedSeekerRefund)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Provider Payout
                        </p>
                        <p className="text-base font-semibold text-emerald-600">
                          {formatInr(providerPayoutAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={distributableAmount}
                        step={0.01}
                        value={clampedSeekerRefund}
                        onChange={(event) =>
                          setSeekerRefundAmount(Number(event.target.value))
                        }
                        disabled={actionLoading || distributableAmount <= 0}
                        className="w-full accent-primary disabled:opacity-60"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatInr(0)} seeker</span>
                        <span>{formatInr(distributableAmount)} seeker</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSeekerRefundAmount(0)}
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-background/80"
                      >
                        Provider Full
                      </button>
                      <button
                        onClick={() =>
                          setSeekerRefundAmount(round2(distributableAmount / 2))
                        }
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-background/80"
                      >
                        50 / 50
                      </button>
                      <button
                        onClick={() =>
                          setSeekerRefundAmount(distributableAmount)
                        }
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-background/80"
                      >
                        Seeker Full
                      </button>
                    </div>

                    <button
                      onClick={handleApplySettlement}
                      disabled={actionLoading || distributableAmount <= 0}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Apply Settlement
                    </button>
                  </div>

                  <button
                    onClick={() => handleResolve("reject")}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" />
                    Reject Complaint
                  </button>
                </>
              )}
            </div>

            {providerAdded && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <UserPlus className="w-3 h-3" />
                Provider has been added to this conversation
              </p>
            )}
          </div>
        )}

        {/* Chat Interface */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-bold">Conversation</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {providerAdded
                ? `3-way chat (Admin, ${seekerLabel} (Seeker), ${providerLabel} (Provider))`
                : `2-way chat (Admin, ${seekerLabel} (Seeker))`}
            </p>
          </div>
          <div className="h-150">
            <ComplaintChat complaintId={id} selfRole="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  if (
    payload &&
    typeof payload === "object" &&
    (payload as { error?: { message?: string } }).error?.message
  ) {
    return (payload as { error: { message: string } }).error.message;
  }
  return fallback;
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    open: "bg-red-500/10 text-red-600 border-red-500/20",
    accepted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    in_review: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    resolved: "bg-green-500/10 text-green-600 border-green-500/20",
    rejected: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold border ${
        colors[status as keyof typeof colors]
      }`}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}
