"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Package,
  Calendar,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type Complaint = {
  _id: string;
  order_id: string;
  seeker_id: string;
  provider_id: string;
  complaint_type: string;
  title?: string;
  description: string;
  status: "open" | "accepted" | "in_review" | "resolved" | "rejected";
  createdAt: string;
  acceptedAt?: string;
  response_deadline?: string;
  provider_access_granted?: boolean;
  seeker?: {
    name: string;
    email: string;
  };
  provider?: {
    name: string;
    businessName?: string;
  };
};

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "open" | "accepted" | "in_review" | "resolved" | "rejected"
  >("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    complaintId: string;
    outcome: "refund_full" | "release_payout" | "reject";
  }>({ isOpen: false, complaintId: "", outcome: "release_payout" });

  useEffect(() => {
    fetchComplaints();
  }, []);

  async function fetchComplaints() {
    try {
      const response = await fetch("/api/admin/complaints");
      if (response.ok) {
        const data = await response.json();
        setComplaints(data);
      }
    } catch (error) {
      console.error("Error fetching complaints:", error);
    } finally {
      setLoading(false);
    }
  }

  async function acceptComplaint(complaintId: string) {
    setActionLoading(complaintId);
    try {
      const response = await fetch(
        `/api/admin/complaints/${complaintId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deadlineDays: 7 }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        toast.success("Complaint accepted. Provider has 7 days to respond.");
        await fetchComplaints();
        setFilter("accepted");
      } else {
        toast.error(data.error || "Failed to accept complaint");
      }
    } catch (error) {
      console.error("Error accepting complaint:", error);
      toast.error("Failed to accept complaint");
    } finally {
      setActionLoading(null);
    }
  }

  // Reserved for future manual status updates if needed
  async function _updateComplaintStatus(
    complaintId: string,
    status: "in_review" | "resolved",
  ) {
    setActionLoading(complaintId);
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchComplaints();
        setFilter(status);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating complaint:", error);
    } finally {
      setActionLoading(null);
    }
  }

  const filteredComplaints = complaints.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/50 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertCircle className="h-3 w-3" />
            Open
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case "in_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            In Review
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Resolved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-900/50 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-400">
            <AlertCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        // Handle any legacy/unknown status values
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 dark:bg-purple-900/50 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-400">
            <AlertCircle className="h-3 w-3" />
            {String(status)}
          </span>
        );
    }
  }

  function getDeadlineStatus(deadline: string | undefined) {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) {
      return (
        <span className="text-xs text-red-500 font-medium">
          Overdue by {Math.abs(daysLeft)} days
        </span>
      );
    } else if (daysLeft === 0) {
      return (
        <span className="text-xs text-red-500 font-medium">Due today</span>
      );
    } else if (daysLeft <= 2) {
      return (
        <span className="text-xs text-amber-500 font-medium">
          {daysLeft} days left
        </span>
      );
    } else {
      return (
        <span className="text-xs text-muted-foreground">
          {daysLeft} days left
        </span>
      );
    }
  }
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading complaints...
          </p>
        </div>
      </div>
    );
  }

  async function resolveComplaint(
    complaintId: string,
    outcome: "refund_full" | "release_payout" | "reject",
  ) {
    try {
      const response = await fetch(
        `/api/admin/complaints/${complaintId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Complaint resolved successfully");
        await fetchComplaints();
      } else {
        toast.error(data.error || "Failed to resolve complaint");
      }
    } catch (error) {
      console.error("Error resolving complaint:", error);
      toast.error("Failed to resolve complaint. Please try again.");
    }
  }

  // ... (keeping existing filters logic)

  // Helper for action buttons
  function renderActions(complaint: Complaint) {
    const isLoading = actionLoading === complaint._id;

    // For resolved/rejected - just show view link
    if (complaint.status === "resolved" || complaint.status === "rejected") {
      return (
        <div className="flex flex-col gap-2 w-full lg:w-52 shrink-0">
          <a
            href={`/admin/complaints/${complaint._id}`}
            className="rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-center text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            View Details
          </a>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 w-full lg:w-52 shrink-0">
        {/* Always show View Details */}
        <a
          href={`/admin/complaints/${complaint._id}`}
          className="rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          View Details
        </a>

        {/* Open → Accept */}
        {complaint.status === "open" && (
          <button
            onClick={() => acceptComplaint(complaint._id)}
            disabled={isLoading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isLoading ? "Accepting..." : "Accept Complaint"}
          </button>
        )}

        {/* Accepted → Add Provider options */}
        {complaint.status === "accepted" && (
          <>
            <a
              href={`/admin/complaints/${complaint._id}`}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 text-center"
            >
              Add Provider to Chat
            </a>
            {complaint.response_deadline && (
              <div className="text-center">
                {getDeadlineStatus(complaint.response_deadline)}
              </div>
            )}
          </>
        )}

        {/* In Review → Resolution Actions */}
        {complaint.status === "in_review" && (
          <>
            <button
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  complaintId: complaint._id,
                  outcome: "release_payout",
                })
              }
              disabled={isLoading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Release Payout
            </button>
            <button
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  complaintId: complaint._id,
                  outcome: "refund_full",
                })
              }
              disabled={isLoading}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Full Refund
            </button>
            <button
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  complaintId: complaint._id,
                  outcome: "reject",
                })
              }
              disabled={isLoading}
              className="rounded-xl border-2 border-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Reject Complaint
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Complaints Management</h1>
          <p className="text-sm text-muted-foreground">
            View and manage user complaints
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{complaints.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-red-500">
              {complaints.filter((c) => c.status === "open").length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Accepted</p>
            <p className="text-2xl font-bold text-blue-500">
              {complaints.filter((c) => c.status === "accepted").length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">In Review</p>
            <p className="text-2xl font-bold text-amber-500">
              {complaints.filter((c) => c.status === "in_review").length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold text-emerald-500">
              {
                complaints.filter(
                  (c) => c.status === "resolved" || c.status === "rejected",
                ).length
              }
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              "all",
              "open",
              "accepted",
              "in_review",
              "resolved",
              "rejected",
            ] as const
          ).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                filter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {status === "all"
                ? "All"
                : status === "in_review"
                  ? "In Review"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Complaints List */}
        {filteredComplaints.length === 0 ? (
          <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
            <AlertCircle className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No complaints found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "all"
                ? "No complaints to display"
                : `No ${filter} complaints`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredComplaints.map((complaint) => (
              <div
                key={complaint._id}
                className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            #{complaint._id.slice(-8)}
                          </h3>
                          {getStatusBadge(complaint.status)}
                        </div>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                          {complaint.complaint_type}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(complaint.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <p className="rounded-xl border bg-background p-3 text-sm">
                      {complaint.description}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {complaint.seeker && (
                        <div className="rounded-xl border bg-background p-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            Seeker
                          </div>
                          <p className="mt-1 text-sm font-medium">
                            {complaint.seeker.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {complaint.seeker.email}
                          </p>
                        </div>
                      )}
                      {complaint.provider && (
                        <div className="rounded-xl border bg-background p-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            Provider
                          </div>
                          <p className="mt-1 text-sm font-medium">
                            {complaint.provider.businessName ||
                              complaint.provider.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {renderActions(complaint)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={async () => {
          await resolveComplaint(
            confirmDialog.complaintId,
            confirmDialog.outcome,
          );
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={`Confirm ${confirmDialog.outcome === "release_payout" ? "Payout Release" : confirmDialog.outcome === "reject" ? "Rejection" : "Refund"}`}
        message={`Are you sure you want to proceed with: ${confirmDialog.outcome.replace(/_/g, " ")}?`}
        confirmText="Proceed"
        cancelText="Cancel"
        variant={confirmDialog.outcome === "refund_full" ? "danger" : "warning"}
      />
    </main>
  );
}
