import { getSeekerBookings } from "@/lib/data/bookings";
import { SeekerBookingList } from "./seeker-booking-list";
import { Metadata } from "next";
import {
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Force dynamic rendering - this page depends on request-scoped auth/session headers.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Bookings | LaundryEase",
  description: "Track your laundry orders and schedule pickups.",
};

export default async function SeekerBookingsPage() {
  const result = await getSeekerBookings();

  if (!result.success || !result.data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground">
            Unable to load bookings
          </h2>
          <p className="mt-2 text-muted-foreground">
            {result.error || "Please try again later or contact support."}
          </p>
        </div>
      </main>
    );
  }

  // Calculate stats
  const stats = {
    pending: result.data.filter((b) => b.status === "requested").length,
    active: result.data.filter((b) =>
      ["accepted", "pickup_proposed", "confirmed", "in_progress"].includes(
        b.status
      )
    ).length,
    completed: result.data.filter((b) => b.status === "completed").length,
    total: result.data.length,
  };

  return (
    <main className="min-h-screen bg-background/50 p-6 space-y-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-6">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              My Bookings
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Track your laundry orders, manage pickups, and view history.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats.pending}
              className="bg-amber-500/10 text-amber-600 border-amber-500/20"
            />
            <StatCard
              icon={Calendar}
              label="Active"
              value={stats.active}
              className="bg-primary/10 text-primary border-primary/20"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.completed}
              className="bg-green-500/10 text-green-600 border-green-500/20"
            />
            <StatCard
              icon={ClipboardList}
              label="Total Orders"
              value={stats.total}
              className="bg-background border-border"
            />
          </div>
        </header>

        {/* Booking List */}
        <SeekerBookingList initialBookings={result.data} />
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all duration-200 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold font-heading">{value}</p>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mt-1">
            {label}
          </p>
        </div>
        <div className="rounded-xl bg-background/50 p-2.5 shadow-sm">
          <Icon className="h-5 w-5 opacity-80" />
        </div>
      </div>
    </div>
  );
}
