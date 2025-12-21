"use client";

import { useState } from "react";
import { PopulatedBooking } from "@/types/bookings";
import { Calendar, MapPin, Clock, User, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ProviderBookingList({ bookings }: { bookings: PopulatedBooking[] }) {
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
                onAccept={handleAccept}
                onReject={handleReject}
                isProcessing={processingId === booking._id}
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
                isProcessing={false}
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
                isProcessing={false}
              />
            ))}
          </div>
        </section>
      )}

      {bookings.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No bookings yet</p>
          <p className="text-sm mt-2">Bookings will appear here when seekers request your services</p>
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  onAccept,
  onReject,
  isProcessing,
}: {
  booking: PopulatedBooking;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  isProcessing: boolean;
}) {
  const statusColors = {
    requested: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    accepted: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    confirmed: "bg-green-500/10 text-green-700 border-green-500/20",
    completed: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    rejected: "bg-red-500/10 text-red-700 border-red-500/20",
    cancelled: "bg-red-500/10 text-red-700 border-red-500/20",
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg text-foreground">
            {booking.seeker.name || "Unknown Seeker"}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[booking.status as keyof typeof statusColors]}`}>
              {booking.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>Booking Fee: ₹{booking.bookingFee}</div>
          <div className="text-xs mt-1">
            {format(new Date(booking.createdAt), "MMM dd, yyyy")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{booking.seeker.email}</span>
          </div>
          {booking.seeker.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{booking.seeker.phone}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {booking.deadline && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                Deadline: {format(new Date(booking.deadline), "MMM dd, yyyy")}
              </span>
            </div>
          )}
          {booking.pickupSlot && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                Pickup: {format(new Date(booking.pickupSlot.dateTime), "MMM dd, hh:mm a")}
              </span>
            </div>
          )}
        </div>
      </div>

      {booking.status === "requested" && onAccept && onReject && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onAccept(booking._id.toString())}
            disabled={isProcessing}
            className="flex-1 h-10 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => onReject(booking._id.toString())}
            disabled={isProcessing}
            className="flex-1 h-10 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {booking.status === "accepted" && (
        <div className="mt-4">
          <button
            onClick={() => {/* TODO: Open pickup scheduling modal */}}
            className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            Schedule Pickup
          </button>
        </div>
      )}
    </div>
  );
}
