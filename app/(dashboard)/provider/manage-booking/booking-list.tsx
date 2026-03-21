"use client";

import { useState, useMemo } from "react";
import { PopulatedBooking, BookingStatus } from "@/types/bookings";
import { BookingCard } from "./booking-card";
import { cn } from "@/lib/utils";
import { Inbox, Search, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveData } from "@/hooks/use-live-data";

interface BookingListProps {
  initialBookings: PopulatedBooking[];
}

type FilterType = "all" | BookingStatus | "active";

const ACTIVE_STATUSES = new Set([
  "requested",
  "accepted",
  "pickup_proposed",
  "confirmed",
  "reschedule_requested",
]);

function hasActiveBookings(bookings: PopulatedBooking[]): boolean {
  return bookings.some((b) => ACTIVE_STATUSES.has(b.status));
}

const TABS: { id: FilterType; label: string; description: string }[] = [
  { id: "requested", label: "Pending", description: "Awaiting your response" },
  { id: "accepted", label: "Accepted", description: "Propose pickup time" },
  {
    id: "pickup_proposed",
    label: "Proposed",
    description: "Waiting for seeker",
  },
  {
    id: "reschedule_requested",
    label: "Reschedule",
    description: "Seeker requested new time",
  },
  { id: "confirmed", label: "Confirmed", description: "Ready for pickup" },
  { id: "completed", label: "Completed", description: "Past bookings" },
  { id: "all", label: "All", description: "View everything" },
];

export function BookingList({ initialBookings }: BookingListProps) {
  const [filter, setFilter] = useState<FilterType>("requested");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bookings, refresh } = useLiveData<PopulatedBooking>({
    url: "/api/bookings/provider",
    initialData: initialBookings,
    activeIntervalMs: 8_000,
    idleIntervalMs: 30_000,
    isActive: hasActiveBookings,
  });

  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Apply status filter
    if (filter !== "all") {
      if (filter === "active") {
        filtered = bookings.filter((b) => ACTIVE_STATUSES.has(b.status));
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
          b._id.toString().toLowerCase().includes(query),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by customer name or booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Filter className="h-4 w-4" />
          <span>{filteredBookings.length} bookings</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative border-b border-border pb-1 overflow-x-auto">
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const isActive = filter === tab.id;
            const count = counts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List Area */}
      {filteredBookings.length === 0 ? (
        <EmptyState filter={filter} onReset={() => setFilter("all")} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <AnimatePresence>
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking._id.toString()}
                booking={booking}
                onRefresh={refresh}
              />
            ))}
          </AnimatePresence>
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
    reschedule_requested: {
      title: "No reschedules",
      description: "Bookings needing a new pickup time will appear here.",
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
    invoice_created: {
      title: "No invoiced bookings",
      description: "Bookings with invoices pending approval or payment.",
    },
    all: {
      title: "No bookings yet",
      description: "When customers book your services, they'll appear here.",
    },
  };

  const { title, description } = messages[filter] || messages.all;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-100 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center"
    >
      <div className="rounded-full bg-muted p-5 shadow-sm mb-6">
        <Inbox className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-heading font-bold text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {filter !== "all" && (
        <button
          onClick={onReset}
          className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-all"
        >
          View all bookings
        </button>
      )}
    </motion.div>
  );
}
