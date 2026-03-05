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

        let position: GeolocationPosition | null = null;
        let locationError: GeolocationPositionError | null = null;

        try {
          position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
              });
            },
          );
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error) {
            locationError = error as GeolocationPositionError;
          }
        }

        // Try to mark arrival with or without coordinates
        const res = await fetch(`/api/bookings/${bookingId}/arrive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            position
              ? {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                }
              : {},
          ),
        });

        const data = await res.json().catch(() => ({}));

        // If location was required but not provided, show helpful error
        if (!res.ok && locationError) {
          let locationHelp =
            "Unable to access location. Please enable location permission.";

          if (locationError.code === 1) {
            // PERMISSION_DENIED
            locationHelp =
              "Location permission denied. To mark arrival:\n\n1. Click the lock icon (🔒) in your browser's address bar\n2. Allow location access for this site\n3. Refresh and try again\n\nOr contact support if the issue persists.";
          } else if (locationError.code === 2) {
            // POSITION_UNAVAILABLE
            locationHelp =
              "Location unavailable. Please:\n\n1. Check your device's location services are ON\n2. Ensure you're not in an area with poor GPS signal\n3. Try moving to a window or outdoor area\n\nOr contact support for manual arrival confirmation.";
          } else if (locationError.code === 3) {
            // TIMEOUT
            locationHelp =
              "Location request timed out. Please:\n\n1. Ensure you have good GPS signal\n2. Try moving to a window or outdoor area\n3. Check your device's location settings\n\nOr contact support for assistance.";
          }

          toast({
            title: "Failed to mark arrival",
            description: locationHelp,
            type: "error",
          });
          return;
        }

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
