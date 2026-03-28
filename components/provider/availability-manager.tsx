"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { useToast } from "@/components/ui/toast";
import { unwrapApiData } from "@/lib/client-api";
import { formatDateKey } from "@/lib/date-key";
import type {
  ProviderAvailabilitySummary,
  ProviderLeavePeriod,
} from "@/types/users";
import type { LeaveConflictSummary } from "@/lib/services/provider-availability";

type AvailabilityPayload = {
  leavePeriods: ProviderLeavePeriod[];
  availability: ProviderAvailabilitySummary;
  conflicts?: LeaveConflictSummary;
};

export function AvailabilityManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leavePeriods, setLeavePeriods] = useState<ProviderLeavePeriod[]>([]);
  const [availability, setAvailability] = useState<ProviderAvailabilitySummary>({
    isCurrentlyOnLeave: false,
    isUnavailableForRequestedDeadline: false,
  });
  const [conflicts, setConflicts] = useState<LeaveConflictSummary | null>(null);

  const todayKey = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  useEffect(() => {
    async function loadAvailability() {
      try {
        const res = await fetch("/api/provider/availability", {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        const data = unwrapApiData<AvailabilityPayload>(payload);

        if (!res.ok) {
          throw new Error(
            payload?.error?.message || payload?.message || "Failed to load leave periods",
          );
        }

        setLeavePeriods(data.leavePeriods ?? []);
        setAvailability(
          data.availability ?? {
            isCurrentlyOnLeave: false,
            isUnavailableForRequestedDeadline: false,
          },
        );
      } catch (error) {
        toast({
          title: "Failed to load availability",
          description:
            error instanceof Error ? error.message : "Please try again.",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();
  }, [toast]);

  async function handleCreateLeave() {
    if (!startDate || !endDate) {
      toast({
        title: "Select both dates",
        description: "Choose a leave start and end date first.",
        type: "warning",
      });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/provider/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = await res.json().catch(() => ({}));
      const data = unwrapApiData<AvailabilityPayload>(payload);

      if (!res.ok) {
        throw new Error(
          payload?.error?.message || payload?.message || "Failed to save leave",
        );
      }

      setLeavePeriods(data.leavePeriods ?? []);
      setAvailability(
        data.availability ?? {
          isCurrentlyOnLeave: false,
          isUnavailableForRequestedDeadline: false,
        },
      );
      setConflicts(data.conflicts ?? null);
      setStartDate("");
      setEndDate("");

      toast({
        title: "Leave saved",
        description: "New bookings will be blocked for the selected days.",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to save leave",
        description:
          error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLeave(leaveId: string) {
    setDeletingId(leaveId);

    try {
      const res = await fetch(`/api/provider/availability/${leaveId}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      const data = unwrapApiData<AvailabilityPayload & { deleted?: boolean }>(
        payload,
      );

      if (!res.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.message ||
            "Failed to delete leave period",
        );
      }

      setLeavePeriods(data.leavePeriods ?? []);
      setAvailability(
        data.availability ?? {
          isCurrentlyOnLeave: false,
          isUnavailableForRequestedDeadline: false,
        },
      );

      toast({
        title: "Leave deleted",
        description: "This date range is available for new bookings again.",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to delete leave",
        description:
          error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">
              Manage Availability
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Add full-day leave periods to block new bookings while keeping
              your profile visible to seekers.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
              availability.isCurrentlyOnLeave
                ? "bg-amber-500/10 text-amber-700 ring-amber-500/20"
                : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                availability.isCurrentlyOnLeave ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            {availability.isCurrentlyOnLeave
              ? `On leave until ${formatDateKey(availability.activeLeaveEndDate)}`
              : "Open for new bookings"}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold font-heading">Add Leave Period</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Leave is stored as inclusive full-day dates in India time.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Start Date
            </label>
            <DateTimePicker
              value={startDate}
              onChange={setStartDate}
              min={todayKey}
              mode="date"
              placeholder="Select start date"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              End Date
            </label>
            <DateTimePicker
              value={endDate}
              onChange={setEndDate}
              min={startDate || todayKey}
              mode="date"
              placeholder="Select end date"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreateLeave}
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Leave
          </button>
        </div>
      </section>

      {conflicts && (conflicts.bookings.length > 0 || conflicts.orders.length > 0) && (
        <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold font-heading text-amber-900">
                  Existing work may be affected
                </h2>
                <p className="mt-1 text-sm text-amber-800/80">
                  Leave blocks new bookings only. Review these existing items
                  and reschedule or finish them manually.
                </p>
              </div>

              {conflicts.bookings.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Bookings ({conflicts.bookings.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {conflicts.bookings.map((conflict) => (
                      <div
                        key={`booking-${conflict.id}`}
                        className="rounded-2xl border border-amber-500/20 bg-background/80 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Booking #{conflict.id.slice(-6).toUpperCase()}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Status: {conflict.status}
                              {conflict.scheduledDate
                                ? ` · Pickup ${formatDateKey(conflict.scheduledDate)}`
                                : ""}
                              {conflict.deadlineDate
                                ? ` · Deadline ${formatDateKey(conflict.deadlineDate)}`
                                : ""}
                            </p>
                          </div>
                          <Link
                            href={conflict.href}
                            className="text-sm font-bold text-primary hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {conflicts.orders.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Orders ({conflicts.orders.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {conflicts.orders.map((conflict) => (
                      <div
                        key={`order-${conflict.id}`}
                        className="rounded-2xl border border-amber-500/20 bg-background/80 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Order #{conflict.id.slice(-6).toUpperCase()}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Status: {conflict.status}
                              {conflict.scheduledDate
                                ? ` · Delivery ${formatDateKey(conflict.scheduledDate)}`
                                : ""}
                              {conflict.deadlineDate
                                ? ` · Deadline ${formatDateKey(conflict.deadlineDate)}`
                                : ""}
                            </p>
                          </div>
                          <Link
                            href={conflict.href}
                            className="text-sm font-bold text-primary hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-heading">Upcoming Leave</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Existing commitments stay visible to seekers. Only new bookings are blocked.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {leavePeriods.length} saved
          </div>
        </div>

        {leavePeriods.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            No leave periods yet.
          </div>
        ) : (
          <div className="space-y-3">
            {leavePeriods.map((leavePeriod) => {
              const leaveId =
                typeof leavePeriod._id === "string"
                  ? leavePeriod._id
                  : leavePeriod._id?.toString?.() ?? "";

              return (
                <div
                  key={leaveId}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatDateKey(leavePeriod.startDate)} to{" "}
                      {formatDateKey(leavePeriod.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved {format(new Date(leavePeriod.createdAt), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteLeave(leaveId)}
                    disabled={deletingId === leaveId}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === leaveId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
