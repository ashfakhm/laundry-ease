"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PROVIDER_CANCELLATION_REASONS = [
  "Unable to meet the scheduled pickup time",
  "Service area unavailable",
  "Staffing or vehicle issue",
  "Equipment/service issue",
  "Emergency",
  "Other",
] as const;

interface ProviderCancelBookingModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function ProviderCancelBookingModal({
  open,
  loading,
  onClose,
  onSubmit,
}: ProviderCancelBookingModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedReason("");
      setCustomReason("");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose, open]);

  const finalReason = useMemo(() => {
    if (selectedReason === "Other") {
      return customReason.trim();
    }

    return selectedReason.trim();
  }, [customReason, selectedReason]);

  if (!open) {
    return null;
  }

  const isOtherReason = selectedReason === "Other";
  const canSubmit = finalReason.length > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!loading) {
            onClose();
          }
        }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 inline-flex rounded-full bg-red-100 p-3 dark:bg-red-900/20">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          <h3 className="text-lg font-bold text-foreground">
            Cancel Booking
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the reason the seeker should see before cancelling this
            booking. If the booking fee was paid, it will be refunded to the
            seeker.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cancellation Reason
              </label>
              <Select
                value={selectedReason}
                onValueChange={(value) => setSelectedReason(value)}
                disabled={loading}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_CANCELLATION_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isOtherReason && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom Reason
                </label>
                <textarea
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  disabled={loading}
                  maxLength={280}
                  rows={4}
                  placeholder="Type the reason the seeker should see..."
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
                />
              </div>
            )}

            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              This action cancels the booking immediately after you confirm.
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Keep Booking
            </button>
            <button
              type="button"
              onClick={() => onSubmit(finalReason)}
              disabled={!canSubmit || loading}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Cancelling..." : "Cancel Booking"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
