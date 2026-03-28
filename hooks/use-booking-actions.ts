"use client";

import { useTransition, useState } from "react";
import { useToast } from "@/components/ui/toast";
import {
  updateBookingStatus,
  proposePickupSlot,
} from "@/app/actions/booking-actions";

export function useBookingActions(bookingId: string, onRefresh?: () => void) {
  const [isPending, startTransition] = useTransition();
  const [slotDate, setSlotDate] = useState("");
  const { toast } = useToast();

  const handleAction = (action: "accept" | "reject") => {
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, action);
      if (result.success) {
        toast({
          title: action === "accept" ? "Booking accepted" : "Booking Declined",
          description: result.message,
          type: action === "accept" ? "success" : "info",
        });
        onRefresh?.();
      } else {
        toast({
          title: "Action failed",
          description: result.error || "Please try again",
          type: "error",
        });
      }
    });
  };

  const handleProposeSlot = () => {
    if (!slotDate) {
      toast({
        title: "Select a date",
        description: "Please select a date and time for pickup",
        type: "warning",
      });
      return;
    }

    startTransition(async () => {
      const result = await proposePickupSlot(bookingId, slotDate);
      if (result.success) {
        toast({
          title: "Slot proposed",
          description: result.message,
          type: "success",
        });
        onRefresh?.();
      } else {
        toast({
          title: "Failed to propose slot",
          description: result.error || "Please try again",
          type: "error",
        });
      }
    });
  };

  const handleArrive = () => {
    startTransition(async () => {
      try {
        // Location verification disabled - providers can mark arrival without GPS
        const res = await fetch(`/api/bookings/${bookingId}/arrive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast({
            title: "Failed to mark arrival",
            description: data?.error || data?.message || "Please try again.",
            type: "error",
          });
          return;
        }

        toast({
          title: "Arrival Confirmed",
          description: data?.message || "Marked as arrived successfully",
          type: "success",
        });
        onRefresh?.();
      } catch (error) {
        toast({
          title: "Failed to mark arrival",
          description: error instanceof Error ? error.message : "Please retry.",
          type: "error",
        });
      }
    });
  };

  const handleRequestReschedule = () => {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/bookings/${bookingId}/reschedule/request`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        if (res.ok) {
          toast({
            title: "Reschedule requested",
            description: "Please propose a new pickup time.",
            type: "info",
          });
          onRefresh?.();
          return;
        }

        const data = await res.json().catch(() => ({}));
        toast({
          title: "Failed to request reschedule",
          description:
            data?.error?.message || data?.message || "Please try again",
          type: "error",
        });
      } catch (e: unknown) {
        toast({
          title: "Failed to request reschedule",
          description: e instanceof Error ? e.message : "Please try again",
          type: "error",
        });
      }
    });
  };

  function executeCancelBooking(reason: string, onSuccess?: () => void) {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast({
        title: "Cancellation reason required",
        description: "Please choose or enter a reason before cancelling.",
        type: "warning",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: trimmedReason,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast({
            title: "Failed to cancel booking",
            description: data?.message || data?.error || "Please try again",
            type: "error",
          });
          return;
        }

        toast({
          title: "Booking cancelled",
          description: data?.message || "Booking cancelled successfully",
          type: "success",
        });
        onSuccess?.();
        onRefresh?.();
      } catch {
        toast({
          title: "Failed to cancel booking",
          description: "Network error. Please try again.",
          type: "error",
        });
      }
    });
  }

  function handleCancelBooking(reason: string, onSuccess?: () => void) {
    executeCancelBooking(reason, onSuccess);
  }

  return {
    isPending,
    slotDate,
    setSlotDate,
    handleAction,
    handleProposeSlot,
    handleArrive,
    handleRequestReschedule,
    handleCancelBooking,
  };
}
