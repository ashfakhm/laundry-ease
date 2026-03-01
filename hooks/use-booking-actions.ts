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
          title: action === "accept" ? "Booking accepted" : "Booking rejected",
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
        if (!navigator.geolocation) {
          toast({
            title: "Location unavailable",
            description: "Geolocation is not supported in this browser.",
            type: "error",
          });
          return;
        }

        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          },
        );

        const res = await fetch(`/api/bookings/${bookingId}/arrive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({
            title: "Failed to mark arrival",
            description:
              data?.error || data?.message || "Please retry from location.",
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
        const isGeolocationError =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          "message" in error;
        const description = isGeolocationError
          ? "Unable to access location. Please enable location permission."
          : error instanceof Error
            ? error.message
            : "Please retry.";

        toast({ title: "Failed to mark arrival", description, type: "error" });
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

  const handleCancelBooking = () => {
    if (
      !confirm(
        "Cancel this booking? If booking fee was paid, it will be refunded to the seeker.",
      )
    )
      return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Provider cancelled booking from dashboard",
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
        onRefresh?.();
      } catch {
        toast({
          title: "Failed to cancel booking",
          description: "Network error. Please try again.",
          type: "error",
        });
      }
    });
  };

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
