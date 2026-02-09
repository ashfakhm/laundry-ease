import { cn } from "@/lib/utils";
import { BookingStatus } from "@/types/bookings";
import {
  CheckCircle,
  Clock,
  XCircle,
  PlayCircle,
  PackageCheck,
  Calendar,
  AlertCircle,
} from "lucide-react";

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  requested: {
    label: "Pending",
    icon: Clock,
    className:
      "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 shadow-amber-100/50 dark:shadow-amber-900/20",
  },
  accepted: {
    label: "Accepted",
    icon: PlayCircle,
    className:
      "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-blue-100/50 dark:shadow-blue-900/20",
  },
  pickup_proposed: {
    label: "Proposed",
    icon: Calendar,
    className:
      "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-indigo-100/50 dark:shadow-indigo-900/20",
  },
  reschedule_requested: {
    label: "Reschedule",
    icon: Clock,
    className:
      "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 shadow-amber-100/50 dark:shadow-amber-900/20",
  },
  rejected: {
    label: "Declined",
    icon: XCircle,
    className:
      "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 shadow-red-100/50 dark:shadow-red-900/20",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    className:
      "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shadow-emerald-100/50 dark:shadow-emerald-900/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: AlertCircle,
    className:
      "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 shadow-gray-100/50 dark:shadow-gray-900/20",
  },
  invoice_created: {
    label: "Invoiced",
    icon: PackageCheck,
    className:
      "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 shadow-teal-100/50 dark:shadow-teal-900/20",
  },
  completed: {
    label: "Completed",
    icon: PackageCheck,
    className:
      "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-purple-100/50 dark:shadow-purple-900/20",
  },
};

export function BookingStatusBadge({
  status,
  className,
}: BookingStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    icon: Clock,
    className:
      "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border shadow-sm",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
