"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, XCircle, Clock, User, Mail, Phone } from "lucide-react";

type Booking = {
  _id: string;
  seeker_id: string;
  provider_id: string;
  status: "requested" | "accepted" | "rejected";
  createdAt: string;
  seeker?: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    address?: {
      line1: string;
      city: string;
      state: string;
      postalCode: string;
    };
  };
};

export default function ManageBookingsPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "requested" | "accepted" | "rejected"
  >("requested");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [session]);

  async function fetchBookings() {
    try {
      const response = await fetch("/api/bookings/provider");
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBooking(bookingId: string, action: "accept" | "reject") {
    setProcessing(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "PATCH",
      });

      if (response.ok) {
        // Refresh bookings list
        await fetchBookings();
      } else {
        const data = await response.json();
        alert(data.message || data.error || `Failed to ${action} booking`);
      }
    } catch (error) {
      console.error(`Error ${action}ing booking:`, error);
      alert(`Failed to ${action} booking`);
    } finally {
      setProcessing(null);
    }
  }

  const filteredBookings = bookings.filter((booking) => {
    if (filter === "all") return true;
    return booking.status === filter;
  });

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading bookings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Manage Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Accept or reject booking requests from seekers
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("requested")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "requested"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Pending ({bookings.filter((b) => b.status === "requested").length})
          </button>
          <button
            onClick={() => setFilter("accepted")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "accepted"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Accepted ({bookings.filter((b) => b.status === "accepted").length})
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "rejected"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Rejected ({bookings.filter((b) => b.status === "rejected").length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            All ({bookings.length})
          </button>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
            <Clock className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No bookings found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "requested"
                ? "No pending booking requests"
                : `No ${filter} bookings to display`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div
                key={booking._id}
                className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">
                          Booking #{booking._id.slice(-8)}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(booking.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                      {booking.status === "accepted" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle className="h-3 w-3" />
                          Accepted
                        </span>
                      )}
                      {booking.status === "rejected" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </span>
                      )}
                      {booking.status === "requested" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </div>

                    {booking.seeker && (
                      <div className="rounded-xl border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <User className="h-4 w-4 text-emerald-600" />
                          Customer Details
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{booking.seeker.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{booking.seeker.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              {booking.seeker.phone || "Not provided"}
                            </span>
                          </div>
                          {booking.seeker.address && (
                            <div className="mt-2 rounded-lg bg-muted p-2 text-xs">
                              <p className="font-medium">Pickup Address:</p>
                              <p className="mt-1 text-muted-foreground">
                                {booking.seeker.address.line1},{" "}
                                {booking.seeker.address.city},{" "}
                                {booking.seeker.address.state} -{" "}
                                {booking.seeker.address.postalCode}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {booking.status === "requested" && (
                    <div className="flex gap-2 lg:flex-col lg:w-32">
                      <button
                        onClick={() => handleBooking(booking._id, "accept")}
                        disabled={processing === booking._id}
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 lg:flex-none"
                      >
                        {processing === booking._id ? "..." : "Accept"}
                      </button>
                      <button
                        onClick={() => handleBooking(booking._id, "reject")}
                        disabled={processing === booking._id}
                        className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 lg:flex-none"
                      >
                        {processing === booking._id ? "..." : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
