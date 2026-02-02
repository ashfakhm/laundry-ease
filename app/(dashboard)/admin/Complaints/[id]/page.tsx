"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, CheckCircle, Ban } from "lucide-react";
import Link from "next/link";
import ComplaintChat from "@/components/complaint-chat";
import { toast } from "sonner";

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

  const fetchComplaint = useCallback(async () => {
    try {
      const res = await fetch(`/api/complaints/${id}`);
      if (res.ok) {
        const data = await res.json();
        setComplaint(data);
      } else {
        toast.error("Failed to load complaint");
      }
    } catch (error) {
      console.error("Error fetching complaint:", error);
      toast.error("Failed to load complaint");
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
        toast.success("Provider added to conversation");
        fetchComplaint(); // Refresh
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to add provider");
      }
    } catch (error) {
      console.error("Error adding provider:", error);
      toast.error("Failed to add provider");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve(
    outcome: "release_payout" | "refund_full" | "reject",
  ) {
    if (!confirm(`Are you sure you want to ${outcome.replace(/_/g, " ")}?`))
      return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/complaints/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });

      if (res.ok) {
        toast.success("Complaint resolved successfully");
        router.push("/admin/complaints");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to resolve complaint");
      }
    } catch (error) {
      console.error("Error resolving complaint:", error);
      toast.error("Failed to resolve complaint");
    } finally {
      setActionLoading(false);
    }
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
                        toast.success("Complaint accepted");
                        fetchComplaint();
                      } else {
                        const data = await res.json();
                        toast.error(data.error?.message || "Failed to accept");
                      }
                    } catch {
                      toast.error("Failed to accept complaint");
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
                  <button
                    onClick={() => handleResolve("release_payout")}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Release Payout
                  </button>

                  <button
                    onClick={() => handleResolve("refund_full")}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" />
                    Full Refund
                  </button>

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
                ? "3-way chat (Admin, Seeker, Provider)"
                : "2-way chat (Admin, Seeker)"}
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
