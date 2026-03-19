"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Package,
  Calendar,
} from "lucide-react";
import { reportError } from "@/lib/client-error";
import { unwrapApiArray } from "@/lib/client-api";

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
    profilePicture?: string;
  };
};

function getProviderDisplayName(provider?: {
  name?: string;
  businessName?: string;
}): string {
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

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "open" | "accepted" | "in_review" | "resolved" | "rejected"
  >("all");

  useEffect(() => {
    fetchComplaints();
  }, []);

  async function fetchComplaints() {
    try {
      const response = await fetch("/api/admin/complaints", {
        cache: "no-store",
      });
      if (response.ok) {
        const payload = await response.json();
        const data = unwrapApiArray<Complaint>(payload);
        setComplaints(data);
      }
    } catch (error) {
      reportError("ComplaintFetchError", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredComplaints = complaints.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });
  const openCount = complaints.filter((c) => c.status === "open").length;
  const acceptedCount = complaints.filter(
    (c) => c.status === "accepted",
  ).length;
  const inReviewCount = complaints.filter(
    (c) => c.status === "in_review",
  ).length;
  const inProgressCount = acceptedCount + inReviewCount;
  const resolvedCount = complaints.filter(
    (c) => c.status === "resolved",
  ).length;
  const rejectedCount = complaints.filter(
    (c) => c.status === "rejected",
  ).length;
  const activeCount = openCount + inProgressCount;

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

  // Helper for action buttons
  function renderActions(complaint: Complaint) {
    return (
      <div className="flex flex-col gap-2 w-full lg:w-52 shrink-0">
        <a
          href={`/admin/complaints/${complaint._id}`}
          className="rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          View Details
        </a>
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

        {/* Premium Stats Grid */}
        <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card/50 p-5 shadow-sm backdrop-blur-md">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Complaints
            </p>
            <div className="mt-3 flex items-baseline">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {complaints.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeCount} active complaints
            </p>
          </div>
          <div className="rounded-2xl border bg-card/50 p-5 shadow-sm backdrop-blur-md">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Open Issues
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-red-600">
                {openCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {openCount > 0 ? "Action needed" : "No open issues"}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border bg-card/50 p-5 shadow-sm backdrop-blur-md">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              In Progress
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-amber-600">
                {inProgressCount}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {acceptedCount} accepted, {inReviewCount} in review
            </p>
          </div>
          <div className="rounded-2xl border bg-card/50 p-5 shadow-sm backdrop-blur-md">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Resolved
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-emerald-600">
                {resolvedCount}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {rejectedCount} rejected
            </p>
          </div>
        </div>

        {/* Tabbed Filters */}
        <div className="mb-6 flex overflow-x-auto border-b border-border/60 pb-1">
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
              className={`relative px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                filter === status
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {status === "all"
                ? "All Complaints"
                : status === "in_review"
                  ? "In Review"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              {filter === status && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Complaints Table/List */}
        {filteredComplaints.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border py-20 text-center bg-card/30">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              All Caught Up
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              {filter === "all"
                ? "There are no complaints in the system currently."
                : `No complaints with status "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredComplaints.map((complaint) => (
              <div
                key={complaint._id}
                className="group relative rounded-2xl border bg-card/60 p-6 shadow-sm backdrop-blur-sm transition-all hover:bg-card/80 hover:shadow-md"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                            #{complaint._id.slice(-8).toUpperCase()}
                          </span>
                          {getStatusBadge(complaint.status)}
                        </div>
                        <h3 className="font-semibold text-foreground text-lg">
                          {complaint.complaint_type}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-background/50 px-2.5 py-1 rounded-full border border-border/50">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(complaint.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                      {complaint.description}
                    </p>

                    <div className="flex flex-wrap gap-4">
                      {complaint.seeker && (
                        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-2.5 pr-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Seeker
                            </p>
                            <p className="text-sm font-semibold">
                              {complaint.seeker.name}
                            </p>
                          </div>
                        </div>
                      )}
                      {complaint.provider && (
                        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-2.5 pr-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 overflow-hidden shrink-0">
                            {complaint.provider.profilePicture ? (
                              <Image
                                src={complaint.provider.profilePicture}
                                alt={getProviderDisplayName(complaint.provider)}
                                width={32}
                                height={32}
                                sizes="32px"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Provider
                            </p>
                            <p className="text-sm font-semibold">
                              {getProviderDisplayName(complaint.provider)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="w-full lg:w-auto shrink-0 pt-2 lg:pt-0">
                    {renderActions(complaint)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
