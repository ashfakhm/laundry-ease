"use client";

import { memo, useState } from "react";
import { PopulatedBooking } from "@/types/bookings";
import { BookingStatusBadge } from "./booking-status-badge";
import {
  Calendar,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface BookingCardProps {
  booking: PopulatedBooking;
  onRefresh: () => void;
}

function BookingCardComponent({ booking, onRefresh }: BookingCardProps) {
  const [processing, setProcessing] = useState(false);
  const [slotDate, setSlotDate] = useState("");
  const { toast } = useToast();

  async function handleAction(action: "accept" | "reject") {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/${action}`, {
        method: "PATCH",
      });
      if (res.ok) {
        toast({
          title: action === "accept" ? "Booking accepted" : "Booking rejected",
          description:
            action === "accept"
              ? "You can now propose a pickup slot"
              : "The seeker will be notified",
          type: action === "accept" ? "success" : "info",
        });
        onRefresh();
      } else {
        const data = await res.json();
        toast({
          title: "Action failed",
          description: data.error || "Please try again",
          type: "error",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Something went wrong",
        description: "Network error. Please try again.",
        type: "error",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleProposeSlot() {
    if (!slotDate) {
      toast({
        title: "Select a date",
        description: "Please select a date and time for pickup",
        type: "warning",
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateTime: slotDate, action: "propose" }),
      });

      if (res.ok) {
        toast({
          title: "Slot proposed",
          description: "Waiting for seeker confirmation",
          type: "success",
        });
        onRefresh();
      } else {
        const data = await res.json();
        toast({
          title: "Failed to propose slot",
          description: data.error || "Please try again",
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
      setProcessing(false);
    }
  }

  const statusColors = {
    requested:
      "from-amber-500/10 to-orange-500/5 border-amber-200/50 dark:from-amber-500/20 dark:to-orange-500/10 dark:border-amber-700/50",
    accepted:
      "from-blue-500/10 to-indigo-500/5 border-blue-200/50 dark:from-blue-500/20 dark:to-indigo-500/10 dark:border-blue-700/50",
    pickup_proposed:
      "from-indigo-500/10 to-purple-500/5 border-indigo-200/50 dark:from-indigo-500/20 dark:to-purple-500/10 dark:border-indigo-700/50",
    confirmed:
      "from-emerald-500/10 to-teal-500/5 border-emerald-200/50 dark:from-emerald-500/20 dark:to-teal-500/10 dark:border-emerald-700/50",
    rejected:
      "from-red-500/10 to-rose-500/5 border-red-200/50 dark:from-red-500/20 dark:to-rose-500/10 dark:border-red-700/50",
    cancelled:
      "from-gray-500/10 to-slate-500/5 border-gray-200/50 dark:from-gray-500/20 dark:to-slate-500/10 dark:border-gray-700/50",
    completed:
      "from-purple-500/10 to-violet-500/5 border-purple-200/50 dark:from-purple-500/20 dark:to-violet-500/10 dark:border-purple-700/50",
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-linear-to-br p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 dark:shadow-black/20",
        statusColors[booking.status] ||
          "from-gray-500/10 to-slate-500/5 border-gray-200/50 dark:from-gray-500/20 dark:to-slate-500/10 dark:border-gray-700/50"
      )}
    >
      {/* Decorative element */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/40 dark:bg-white/5 blur-2xl" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-gray-400 dark:text-gray-500">
              #{booking._id.toString().slice(-6).toUpperCase()}
            </span>
            <BookingStatusBadge status={booking.status} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {booking.seeker.name}
          </h3>
        </div>

        {/* Time Info */}
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(booking.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
            {new Date(booking.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Customer Details */}
      <div className="relative mt-4 space-y-2">
        {booking.seeker.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span>{booking.seeker.phone}</span>
          </div>
        )}
        {booking.seeker.address && (
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500 mt-0.5" />
            <span className="line-clamp-1">
              {booking.seeker.address.line1}, {booking.seeker.address.city}
            </span>
          </div>
        )}
      </div>

      {/* Pickup Slot Info */}
      {booking.pickupSlot && (
        <div className="mt-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm p-3 border border-white/80 dark:border-white/10">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              {new Date(booking.pickupSlot.dateTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {booking.pickupSlot.confirmedAt && (
              <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmed
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Area */}
      <div className="relative mt-5 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
        {booking.status === "requested" && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("accept")}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all hover:shadow-md"
            >
              <CheckCircle2 className="h-4 w-4" />
              {processing ? "Accepting..." : "Accept"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all"
            >
              <XCircle className="h-4 w-4" />
              {processing ? "..." : "Decline"}
            </button>
          </div>
        )}

        {booking.status === "accepted" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Propose Pickup Time
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
              />
              <button
                onClick={handleProposeSlot}
                disabled={processing || !slotDate}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                <Send className="h-4 w-4" />
                {processing ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}

        {booking.status === "pickup_proposed" && (
          <div className="flex items-center gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 p-3 text-sm">
            <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="font-medium text-indigo-900 dark:text-indigo-200">
                Awaiting Confirmation
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                Customer needs to confirm the proposed time
              </p>
            </div>
          </div>
        )}

        {booking.status === "confirmed" && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-3 text-sm">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                Ready for Pickup
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {new Date(
                  booking.pickupSlot?.dateTime as string
                ).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {booking.status === "rejected" && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-950/50 p-3 text-sm">
            <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
            <p className="font-medium text-red-800 dark:text-red-200">
              Booking Declined
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

export const BookingCard = memo(BookingCardComponent);
