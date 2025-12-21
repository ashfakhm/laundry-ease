import { getProviderBookings } from "@/lib/data/bookings";
import { BookingList } from "./booking-list";
import { Metadata } from "next";
import { ClipboardList, Calendar, Clock, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Manage Bookings | LaundryEase Provider",
  description: "View and manage your laundry service bookings.",
};

export default async function ManageBookingsPage() {
  const result = await getProviderBookings();

  if (!result.success || !result.data) {
    return (
      <main className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-800/50">
        <div className="flex h-[60vh] items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <ClipboardList className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Unable to load bookings
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              {result.error || "Please try again later."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Calculate stats
  const stats = {
    pending: result.data.filter((b) => b.status === "requested").length,
    confirmed: result.data.filter((b) => b.status === "confirmed").length,
    completed: result.data.filter((b) => b.status === "completed").length,
    total: result.data.length,
  };

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Manage Bookings
              </h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Review requests, propose pickup times, and track order status.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats.pending}
              color="amber"
            />
            <StatCard
              icon={Calendar}
              label="Confirmed"
              value={stats.confirmed}
              color="emerald"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.completed}
              color="blue"
            />
            <StatCard
              icon={ClipboardList}
              label="Total"
              value={stats.total}
              color="gray"
            />
          </div>
        </header>

        {/* Booking List */}
        <BookingList initialBookings={result.data} />
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: "amber" | "emerald" | "blue" | "gray";
}) {
  const colorClasses = {
    amber:
      "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50",
    emerald:
      "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50",
    blue: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
    gray: "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-700",
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${colorClasses[color]} transition-transform hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white/80 dark:bg-white/10 p-2 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs font-medium opacity-80">{label}</p>
        </div>
      </div>
    </div>
  );
}
