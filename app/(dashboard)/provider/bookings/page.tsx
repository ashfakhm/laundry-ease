"use client";

import { useState, useEffect } from "react";
import { ProviderBookingList } from "@/components/providers/provider-booking-list";

export default function ProviderBookingsPage() {
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch("/api/bookings/provider");
        if (!res.ok) {
          throw new Error("Failed to fetch bookings");
        }
        const data = await res.json();
        setBookings(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !bookings) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive">
          {error || "Failed to load bookings"}
        </div>
      </div>
    );
  }

  const pending = bookings.filter((b) => b.status === "requested");
  const accepted = bookings.filter((b) => b.status === "accepted");
  const completed = bookings.filter((b) => b.status === "completed");

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Booking Requests
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your booking requests and schedule pickups
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Pending
          </div>
          <div className="text-3xl font-bold text-foreground mt-2">
            {pending.length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Accepted
          </div>
          <div className="text-3xl font-bold text-foreground mt-2">
            {accepted.length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Completed
          </div>
          <div className="text-3xl font-bold text-foreground mt-2">
            {completed.length}
          </div>
        </div>
      </div>

      {/* Booking List */}
      <ProviderBookingList bookings={bookings} />
    </div>
  );
}
