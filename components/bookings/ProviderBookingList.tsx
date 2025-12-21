"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

// Define strict type mirroring the serialized data from Server Component
type SerializedBooking = {
  _id: string;
  seeker_id: string;
  provider_id: string;
  status: "requested" | "accepted" | "rejected";
  createdAt: string;
  seeker?: {
    _id: string;
    name: string | null;
    email: string;
    phone: string | null;
    address?: {
      line1: string;
      city: string;
      state: string;
      postalCode: string;
    } | null;
  };
  pickupSlot?: {
    proposedBy: "provider" | "seeker";
    dateTime: string;
    confirmedAt?: string;
  };
};

export function ProviderBookingList({
  initialBookings,
}: {
  initialBookings: SerializedBooking[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bookings, setBookings] =
    useState<SerializedBooking[]>(initialBookings);
  const [filter, setFilter] = useState<
    "all" | "requested" | "accepted" | "rejected"
  >("requested");
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleBooking(bookingId: string, action: "accept" | "reject") {
    setProcessing(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "PATCH",
      });

      if (response.ok) {
        router.refresh();
        setBookings((prev) =>
          prev.map((b) =>
            b._id === bookingId
              ? { ...b, status: action === "accept" ? "accepted" : "rejected" }
              : b
          )
        );
        toast({
          title: action === "accept" ? "Booking accepted" : "Booking rejected",
          description:
            action === "accept"
              ? "The seeker will be notified of your acceptance"
              : "The seeker will be notified of the rejection",
          type: action === "accept" ? "success" : "info",
        });
      } else {
        const data = await response.json();
        toast({
          title: `Failed to ${action} booking`,
          description: data.message || "Please try again",
          type: "error",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: `Failed to ${action} booking`,
        description: "Network error. Please try again.",
        type: "error",
      });
    } finally {
      setProcessing(null);
    }
  }

  async function handleProposeSlot(bookingId: string, dateTime: string) {
    if (!dateTime) return;
    setProcessing(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateTime, action: "propose" }),
      });
      if (res.ok) {
        toast({
          title: "Slot proposed",
          description: "Waiting for seeker confirmation",
          type: "success",
        });
        router.refresh();
      } else {
        const data = await res.json();
        toast({
          title: "Failed to propose slot",
          description: data.message || "Please try again",
          type: "error",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Failed to propose slot",
        description: "Network error. Please try again.",
        type: "error",
      });
    } finally {
      setProcessing(null);
    }
  }

  const filteredBookings = bookings.filter((booking) => {
    if (filter === "all") return true;
    return booking.status === filter;
  });

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setFilter("requested")}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
            filter === "requested"
              ? "bg-emerald-600 text-white"
              : "bg-background hover:bg-muted"
          }`}
        >
          Pending ({bookings.filter((b) => b.status === "requested").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("accepted")}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
            filter === "accepted"
              ? "bg-emerald-600 text-white"
              : "bg-background hover:bg-muted"
          }`}
        >
          Accepted ({bookings.filter((b) => b.status === "accepted").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("rejected")}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
            filter === "rejected"
              ? "bg-emerald-600 text-white"
              : "bg-background hover:bg-muted"
          }`}
        >
          Rejected ({bookings.filter((b) => b.status === "rejected").length})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
            filter === "all"
              ? "bg-emerald-600 text-white"
              : "bg-background hover:bg-muted"
          }`}
        >
          All ({bookings.length})
        </button>
      </div>

      {/* List */}
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
              className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition-all duration-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left Column: Info */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Booking #{booking._id.slice(-8)}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(booking.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    {booking.status === "accepted" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                        <CheckCircle className="h-3 w-3" />
                        Accepted
                      </span>
                    )}
                    {booking.status === "rejected" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 uppercase tracking-wider">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </span>
                    )}
                    {booking.status === "requested" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>

                  {booking.seeker && (
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                        <User className="h-4 w-4 text-emerald-600" />
                        Customer Details
                      </div>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4">
                            <User className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium">
                            {booking.seeker.name ?? "Guest"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4">
                            <Mail className="h-3.5 w-3.5" />
                          </span>
                          <span>{booking.seeker.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4">
                            <Phone className="h-3.5 w-3.5" />
                          </span>
                          <span>{booking.seeker.phone || "Not provided"}</span>
                        </div>
                        {booking.seeker.address && (
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-xs text-muted-foreground mb-1">
                              Pickup Address
                            </p>
                            <p className="text-sm font-medium">
                              {booking.seeker.address.line1},{" "}
                              {booking.seeker.address.city}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {booking.seeker.address.state} -{" "}
                              {booking.seeker.address.postalCode}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Actions */}
                <div className="lg:w-64 space-y-3">
                  {booking.status === "requested" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleBooking(booking._id, "accept")}
                        disabled={processing === booking._id}
                        className="col-span-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center"
                      >
                        {processing === booking._id ? "..." : "Accept"}
                      </button>
                      <button
                        onClick={() => handleBooking(booking._id, "reject")}
                        disabled={processing === booking._id}
                        className="col-span-1 rounded-xl border bg-background px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 flex items-center justify-center"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {booking.status === "accepted" && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Schedule Pickup
                      </p>
                      <div className="flex flex-col gap-2">
                        <input
                          type="datetime-local"
                          className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                          id={`date-${booking._id}`}
                        />
                        <button
                          className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                          onClick={() => {
                            const input = (
                              document.getElementById(
                                `date-${booking._id}`
                              ) as HTMLInputElement
                            )?.value;
                            handleProposeSlot(booking._id, input);
                          }}
                        >
                          Propose Slot
                        </button>
                      </div>
                      {booking.pickupSlot && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p className="text-xs text-blue-800">
                            Last proposed: <br />
                            <span className="font-mono">
                              {new Date(
                                booking.pickupSlot.dateTime
                              ).toLocaleString()}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
