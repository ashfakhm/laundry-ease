"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function PickupScheduler({
  bookingId,
  deadline,
  onClose,
}: {
  bookingId: string;
  deadline?: string | Date;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Compute min/max for date/time pickers
  const now = new Date();
  const minDateTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h from now
  const minDate = minDateTime.toISOString().split("T")[0];
  const maxDate = deadline
    ? new Date(deadline).toISOString().split("T")[0]
    : new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  async function handlePropose() {
    if (!date || !time) {
      toast.error("Please select both date and time");
      return;
    }
    const dateTime = new Date(`${date}T${time}`);
    const minDateTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const maxDateTime = deadline
      ? new Date(deadline)
      : new Date(now.getTime() + 48 * 60 * 60 * 1000);
    if (dateTime < minDateTime) {
      toast.error("Pickup must be at least 2 hours from now");
      return;
    }
    if (dateTime > maxDateTime) {
      toast.error("Pickup cannot be after seeker's deadline");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateTime: dateTime.toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose pickup time");
      }
      toast.success("Pickup time proposed! Waiting for seeker confirmation.");
      router.refresh();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to propose pickup time";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <h2 className="text-xl font-bold mb-2 pr-8 text-foreground">
          Schedule Pickup
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Propose a pickup time for the seeker to confirm
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Pickup Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              max={maxDate}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Pickup Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground">
              • Pickup must be at least 2 hours from now
              <br />
              • Pickup cannot be after seeker&apos;s deadline
              <br />• Seeker must confirm before you visit
            </p>
          </div>

          <button
            onClick={handlePropose}
            disabled={isSubmitting}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Propose Pickup Time
          </button>
        </div>
      </div>
    </div>
  );
}
