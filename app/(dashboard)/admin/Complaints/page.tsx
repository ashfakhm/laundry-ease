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
  >("open");

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
    status: "in_progress" | "resolved"
  ) {
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchComplaints();
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
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-bold">{complaints.length}</p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium text-red-600">Open</p>
            <p className="mt-1 text-2xl font-bold">
              {complaints.filter((c) => c.status === "open").length}
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium text-amber-600">In Progress</p>
            <p className="mt-1 text-2xl font-bold">
              {complaints.filter((c) => c.status === "in_progress").length}
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-medium text-emerald-600">Resolved</p>
            <p className="mt-1 text-2xl font-bold">
              {complaints.filter((c) => c.status === "resolved").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("open")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "open"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Open ({complaints.filter((c) => c.status === "open").length})
          </button>
          <button
            onClick={() => setFilter("in_progress")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "in_progress"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            In Progress (
            {complaints.filter((c) => c.status === "in_progress").length})
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "resolved"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Resolved ({complaints.filter((c) => c.status === "resolved").length}
            )
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            All ({complaints.length})
          </button>
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

                  {complaint.status !== "resolved" && (
                    <div className="flex gap-2 lg:flex-col lg:w-40">
                      {complaint.status === "open" && (
                        <button
                          onClick={() =>
                            updateComplaintStatus(complaint._id, "in_progress")
                          }
                          className="flex-1 rounded-xl border bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 lg:flex-none"
                        >
                          Start Review
                        </button>
                      )}
                      <button
                        onClick={() =>
                          updateComplaintStatus(complaint._id, "resolved")
                        }
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 lg:flex-none"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
