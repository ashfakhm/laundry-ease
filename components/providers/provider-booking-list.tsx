"use client";

import { PopulatedBooking } from "@/types/bookings";
import { useRouter } from "next/navigation";
import { BookingCard } from "@/app/(dashboard)/provider/Manage-booking/booking-card";

export function ProviderBookingList({
  bookings,
}: {
  bookings: PopulatedBooking[];
}) {
  const router = useRouter();

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

