"use client";

import { useState, useMemo } from "react";
import { PopulatedSeekerBooking, BookingStatus } from "@/types/bookings";
import { SeekerBookingCard } from "./seeker-booking-card";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";

interface SeekerBookingListProps {
  initialBookings: PopulatedSeekerBooking[];
}

type FilterType = "all" | BookingStatus | "active";

export function SeekerBookingList({ initialBookings }: SeekerBookingListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const router = useRouter();

  const bookings = initialBookings;

  const filteredBookings = useMemo(() => {
    if (filter === "all") return bookings;
    if (filter === "active")
      return bookings.filter((b) =>
        ["requested", "accepted", "pickup_proposed", "confirmed"].includes(
          b.status
        )
      );
    return bookings.filter((booking) => booking.status === filter);
  }, [bookings, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    bookings.forEach((b) => {
      c[b.status] = (c[b.status] || 0) + 1;
    });
    return c;
  }, [bookings]);

  const tabs: { id: FilterType; label: string }[] = [
    { id: "all", label: "All Bookings" },
    { id: "requested", label: "Pending" },
    { id: "accepted", label: "Accepted" },
    { id: "pickup_proposed", label: "Review Slot" },
    { id: "confirmed", label: "Scheduled" },
  ];

  return (
    <div className="space-y-6">
      {/* Load Razorpay Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      {/* Filters/Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "group relative rounded-t-lg px-4 py-3 text-sm font-medium transition-colors focus:z-10 whitespace-nowrap",
              filter === tab.id
                ? "text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-800 border-b-2 border-emerald-600 dark:border-emerald-500 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {(counts[tab.id] || 0) > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                    filter === tab.id
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600"
                  )}
                >
                  {counts[tab.id]}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* List Area */}
      {filteredBookings.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-12 text-center">
          <div className="rounded-full bg-white dark:bg-gray-800 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
            <Inbox className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            No bookings found
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {filter === "all"
              ? "You typically haven't made any bookings yet."
              : `You have no ${filter} bookings at the moment.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <SeekerBookingCard
              key={booking._id.toString()}
              booking={booking}
              onRefresh={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
