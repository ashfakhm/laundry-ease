"use client";

import { useState, useMemo } from "react";
import { PopulatedSeekerBooking, BookingStatus } from "@/types/bookings";
import { SeekerBookingCard } from "./seeker-booking-card";
import { cn } from "@/lib/utils";
import { Inbox, ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { RAZORPAY_CHECKOUT_SCRIPT_URL } from "@/lib/constants";

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
    { id: "all", label: "All" },
    { id: "requested", label: "Pending" },
    { id: "accepted", label: "Accepted" },
    { id: "pickup_proposed", label: "Review" },
    { id: "confirmed", label: "Scheduled" },
  ];

  return (
    <div className="space-y-6">
      {/* Load Razorpay Script */}
      <Script
        src={RAZORPAY_CHECKOUT_SCRIPT_URL}
        strategy="lazyOnload"
      />

      {/* Filters/Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "group relative rounded-t-lg px-4 py-3 text-sm font-medium transition-all focus:z-10 whitespace-nowrap",
              filter === tab.id
                ? "text-primary border-b-2 border-primary bg-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {(counts[tab.id] || 0) > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors",
                    filter === tab.id
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground group-hover:bg-muted/80"
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-100 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center"
        >
          <div className="rounded-full bg-muted p-4 shadow-sm">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-heading font-bold text-foreground">
            {filter === "all" ? "No bookings yet" : "No bookings found"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {filter === "all"
              ? "You're all set—your bookings will show up here once you book a provider."
              : `You have no ${filter} bookings at the moment.`}
          </p>

          {filter === "all" && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/seeker"
                className="btn btn-primary rounded-xl h-11 px-6 font-bold inline-flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                Find Providers
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/seeker/view-orders"
                className="btn btn-ghost rounded-xl h-11 px-6 font-bold inline-flex items-center justify-center gap-2 border border-border"
              >
                View Orders
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredBookings.map((booking) => (
              <SeekerBookingCard
                key={booking._id.toString()}
                booking={booking}
                onRefresh={() => router.refresh()}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
