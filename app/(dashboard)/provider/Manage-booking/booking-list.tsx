"use client";

import { useState, useMemo } from "react";
import { PopulatedBooking, BookingStatus } from "@/types/bookings";
import { BookingCard } from "./booking-card";
import { cn } from "@/lib/utils";
import { Inbox, Search, Filter } from "lucide-react";
import { useRouter } from "next/navigation";

interface BookingListProps {
  initialBookings: PopulatedBooking[];
}

type FilterType = "all" | BookingStatus | "active";

const TABS: { id: FilterType; label: string; description: string }[] = [
  { id: "requested", label: "Pending", description: "Awaiting your response" },
  { id: "accepted", label: "Accepted", description: "Propose pickup time" },
  {
    id: "pickup_proposed",
    label: "Proposed",
    description: "Waiting for seeker",
  },
  { id: "confirmed", label: "Confirmed", description: "Ready for pickup" },
  { id: "completed", label: "Completed", description: "Past bookings" },
  { id: "all", label: "All", description: "View everything" },
];

export function BookingList({ initialBookings }: BookingListProps) {
  const [filter, setFilter] = useState<FilterType>("requested");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const bookings = initialBookings;

  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Apply status filter
    if (filter !== "all") {
      if (filter === "active") {
        filtered = bookings.filter((b) =>
          ["requested", "accepted", "pickup_proposed", "confirmed"].includes(
            b.status
          )
        );
      } else {
        filtered = bookings.filter((booking) => booking.status === filter);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.seeker.name.toLowerCase().includes(query) ||
          b.seeker.email.toLowerCase().includes(query) ||
          b._id.toString().toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [bookings, filter, searchQuery]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    bookings.forEach((b) => {
      c[b.status] = (c[b.status] || 0) + 1;
    });
    return c;
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by customer name or booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 dark:focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Filter className="h-4 w-4" />
          <span>{filteredBookings.length} bookings</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => {
            const isActive = filter === tab.id;
            const count = counts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List Area */}
      {filteredBookings.length === 0 ? (
        <EmptyState filter={filter} onReset={() => setFilter("all")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredBookings.map((booking) => (
            <BookingCard
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

function EmptyState({
  filter,
  onReset,
}: {
  filter: FilterType;
  onReset: () => void;
}) {
  const messages: Record<FilterType, { title: string; description: string }> = {
    requested: {
      title: "No pending requests",
      description: "New booking requests will appear here.",
    },
    accepted: {
      title: "No accepted bookings",
      description: "Bookings you accept will appear here for scheduling.",
    },
    pickup_proposed: {
      title: "No proposed pickups",
      description: "Bookings with proposed times waiting for confirmation.",
    },
    confirmed: {
      title: "No confirmed bookings",
      description: "Confirmed pickups ready to be fulfilled.",
    },
    rejected: {
      title: "No rejected bookings",
      description: "Bookings you've declined.",
    },
    cancelled: {
      title: "No cancelled bookings",
      description: "Cancelled bookings will appear here.",
    },
    completed: {
      title: "No completed bookings",
      description: "Finished orders will appear here.",
    },
    active: {
      title: "No active bookings",
      description: "You have no bookings in progress.",
    },
    all: {
      title: "No bookings yet",
      description: "When customers book your services, they'll appear here.",
    },
  };

  const { title, description } = messages[filter] || messages.all;

  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-linear-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-12 text-center">
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700">
        <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {filter !== "all" && (
        <button
          onClick={onReset}
          className="mt-6 rounded-xl bg-gray-900 dark:bg-gray-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white transition-colors"
        >
          View all bookings
        </button>
      )}
    </div>
  );
}
