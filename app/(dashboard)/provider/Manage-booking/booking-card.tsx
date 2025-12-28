"use client";

import { memo, useTransition, useState } from "react";
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
  User,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  updateBookingStatus,
  proposePickupSlot,
  markProviderArrived,
} from "@/app/actions/booking-actions";

interface BookingCardProps {
  booking: PopulatedBooking;
  onRefresh: () => void;
}

function BookingCardComponent({ booking, onRefresh }: BookingCardProps) {
  const [isPending, startTransition] = useTransition();
  // We keep local loading state to block UI immediately, though useTransition handles the mutation pending.
  // Combining them for best UX.
  const [slotDate, setSlotDate] = useState("");
  const { toast } = useToast();

  const handleAction = (action: "accept" | "reject") => {
    startTransition(async () => {
      const result = await updateBookingStatus(booking._id.toString(), action);
      if (result.success) {
        toast({
          title: action === "accept" ? "Booking accepted" : "Booking rejected",
          description: result.message,
          type: action === "accept" ? "success" : "info",
        });
        // onRefresh not strictly needed if revalidatePath works, but keeps parent synced explicitly if needed
        // but revalidatePath in action should trigger router refresh automatically in server components
        // onRefresh -> router.refresh() might be double, but safe.
        onRefresh();
      } else {
        toast({
          title: "Action failed",
          description: result.error || "Please try again",
          type: "error",
        });
      }
    });
  };

  const handleProposeSlot = () => {
    if (!slotDate) {
      toast({
        title: "Select a date",
        description: "Please select a date and time for pickup",
        type: "warning",
      });
      return;
    }

    startTransition(async () => {
      const result = await proposePickupSlot(booking._id.toString(), slotDate);
      if (result.success) {
        toast({
          title: "Slot proposed",
          description: result.message,
          type: "success",
        });
        onRefresh();
      } else {
        toast({
          title: "Failed to propose slot",
          description: result.error || "Please try again",
          type: "error",
        });
      }
    });
  };

  const handleArrive = () => {
    startTransition(async () => {
      const result = await markProviderArrived(booking._id.toString());
      if (result.success) {
        toast({
          title: "Arrival Confirmed",
          description: result.message,
          type: "success",
        });
        onRefresh();
      } else {
        toast({
          title: "Failed to mark arrival",
          description: result.error,
          type: "error",
        });
      }
    });
  };

  const loading = isPending;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shadow-sm">
              {booking.seeker.name?.charAt(0) || "U"}
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
                {booking.seeker.name}
                <BookingStatusBadge status={booking.status} />
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono opacity-70">
                  #{booking._id.toString().slice(-6).toUpperCase()}
                </span>
                <span>•</span>
                <span>{new Date(booking.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="mt-4 rounded-2xl bg-muted/30 p-4 border border-border/50">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <User className="w-3.5 h-3.5" /> Customer Details
        </h4>
        <div className="space-y-2">
          {booking.seeker.phone && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{booking.seeker.phone}</span>
            </div>
          )}
          {booking.seeker.address && (
            <div className="flex items-start gap-2 text-sm text-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <span className="line-clamp-2">
                {booking.seeker.address.line1}, {booking.seeker.address.city}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pickup Slot Info */}
      {booking.pickupSlot && (
        <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
            <Calendar className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              Scheduled Pickup
            </p>
            <p className="text-sm font-bold text-foreground">
              {new Date(booking.pickupSlot.dateTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {booking.pickupSlot.confirmedAt && (
            <div className="ml-auto px-2 py-1 bg-green-500/10 text-green-600 rounded-md text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Confirmed
            </div>
          )}
        </div>
      )}

      {/* Action Area */}
      <div className="relative mt-5 pt-4 border-t border-border/50">
        {booking.status === "requested" && (
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("accept")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Accepting..." : "Accept"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50 transition-all"
            >
              <XCircle className="h-4 w-4" />
              {loading ? "..." : "Decline"}
            </button>
          </div>
        )}

        {booking.status === "accepted" && (
          <div className="space-y-4 rounded-xl bg-blue-500/5 p-4 border border-blue-500/10">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-900">
                Action Required: Propose Pickup Time
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
              />
              <button
                onClick={handleProposeSlot}
                disabled={loading || !slotDate}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <div className="flex items-center gap-2">
                  {loading ? "Sending..." : "Send Proposal"}{" "}
                  <Send className="h-3.5 w-3.5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {booking.status === "pickup_proposed" && (
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-4 border border-border/50 text-sm">
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-foreground">Proposal Sent</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Waiting for customer to confirm time.
              </p>
            </div>
          </div>
        )}

        {booking.status === "confirmed" && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 border border-green-500/20 text-sm">
              <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-700">Ready for Pickup</p>
                <p className="text-xs text-green-600/80 mt-0.5">
                  Prepare for service at scheduled time.
                </p>
              </div>
            </div>

            {/* Provider Arrival Logic */}
            <div className="mt-4 space-y-3">
              {!booking.arrivedAt ? (
                <button
                  onClick={handleArrive}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full h-11 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <MapPin className="h-4 w-4" />
                  {loading ? "Confirming..." : "I Have Arrived"}
                </button>
              ) : (
                <Link
                  href={`/provider/bookings/${booking._id}/invoice`}
                  className="flex items-center justify-center gap-2 w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Create Invoice
                </Link>
              )}
            </div>
          </>
        )}

        {booking.status === "rejected" && (
          <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 border border-destructive/20 text-sm">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="font-bold text-destructive">Booking Declined</p>
          </div>
        )}
      </div>
    </motion.article>
  );
}

export const BookingCard = memo(BookingCardComponent);
