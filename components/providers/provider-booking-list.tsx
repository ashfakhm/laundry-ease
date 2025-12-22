"use client";

import { useState } from "react";
import { PopulatedBooking } from "@/types/bookings";
import { Calendar, MapPin, Clock, User, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { BookingCard } from "@/app/(dashboard)/provider/Manage-booking/booking-card";

export function ProviderBookingList({
  bookings,
}: {
  bookings: PopulatedBooking[];
}) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleAccept(bookingId: string) {
    setProcessingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to accept booking");
      }

      toast.success("Booking accepted! Now schedule a pickup time.");
      router.refresh();
    } catch (error) {
      toast.error("Failed to accept booking");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(bookingId: string) {
    if (!confirm("Are you sure you want to reject this booking?")) {
      return;
    }

    setProcessingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to reject booking");
      }

      toast.success("Booking rejected. Seeker will be refunded.");
      router.refresh();
    } catch (error) {
      toast.error("Failed to reject booking");
    } finally {
      setProcessingId(null);
    }
  }

  const pendingBookings = bookings.filter((b) => b.status === "requested");
  const activeBookings = bookings.filter((b) =>
    ["accepted", "pickup_proposed", "confirmed"].includes(b.status)
  );
  const pastBookings = bookings.filter((b) =>
    ["completed", "rejected", "cancelled"].includes(b.status)
  );

  return (
    <div className="space-y-8">
      {/* Pending Requests */}
      {pendingBookings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Pending Requests ({pendingBookings.length})
          </h2>
          <div className="grid gap-4">
            {pendingBookings.map((booking) => (
              <BookingCard
                key={booking._id.toString()}
                booking={booking}
                onRefresh={router.refresh}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active Bookings */}
      {activeBookings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Active Bookings ({activeBookings.length})
          </h2>
          <div className="grid gap-4">
            {activeBookings.map((booking) => (
              <BookingCard
                key={booking._id.toString()}
                booking={booking}
                onRefresh={router.refresh}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past Bookings */}
      {pastBookings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Past Bookings ({pastBookings.length})
          </h2>
          <div className="grid gap-4">
            {pastBookings.map((booking) => (
              <BookingCard
                key={booking._id.toString()}
                booking={booking}
                onRefresh={router.refresh}
              />
            ))}
          </div>
        </section>
      )}

      {bookings.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No bookings yet</p>
          <p className="text-sm mt-2">
            Bookings will appear here when seekers request your services
          </p>
        </div>
      )}
    </div>
  );
}

// Local BookingCard removed. Using shared component.


