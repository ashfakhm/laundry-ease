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
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
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
    "all" | "open" | "in_progress" | "resolved"
  >("all");
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

  async function updateComplaintStatus(
    complaintId: string,
    status: "in_progress" | "resolved",
  ) {
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchComplaints();
        // Automatically switch filter to show the updated complaint
        setFilter(status);
      }
    } catch (error) {
      console.error("Error updating complaint:", error);
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
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            In Progress
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Resolved
          </span>
        );
      default:
        return null;
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
    if (complaint.status === "resolved") return null;

    return (
      <div className="flex flex-col gap-2 w-full lg:w-48">
        {complaint.status === "open" && (
          <button
            onClick={() => updateComplaintStatus(complaint._id, "in_progress")}
            className="rounded-xl border bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            Start Review
          </button>
        )}

        {complaint.status === "in_progress" && (
          <>
            <button
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  complaintId: complaint._id,
                  outcome: "release_payout",
                })
              }
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Issue Solved: Release Payout
            </button>
            <button
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  complaintId: complaint._id,
                  outcome: "refund_full",
                })
              }
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
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
              className="rounded-xl border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
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
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-amber-500">
              {complaints.filter((c) => c.status === "in_progress").length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold text-emerald-500">
              {complaints.filter((c) => c.status === "resolved").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(["all", "open", "in_progress", "resolved"] as const).map(
            (status) => (
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
                  : status === "in_progress"
                    ? "In Progress"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ),
          )}
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
