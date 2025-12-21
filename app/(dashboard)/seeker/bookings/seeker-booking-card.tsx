"use client";

import { memo, useState } from "react";
import { PopulatedSeekerBooking } from "@/types/bookings";
import { BookingStatusBadge } from "../../provider/Manage-booking/booking-status-badge";
import {
  Calendar,
  User,
  MapPin,
  Phone,
  IndianRupee,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SeekerBookingCardProps {
  booking: PopulatedSeekerBooking;
  onRefresh: () => void;
}

function SeekerBookingCardComponent({
  booking,
  onRefresh,
}: SeekerBookingCardProps) {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  async function handlePayBookingFee() {
    setProcessing(true);
    try {
      // 1. Create Order
      const res = await fetch(`/api/bookings/${booking._id}/pay`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Payment failed",
          description: data.message || "Failed to initiate payment",
          type: "error",
        });
        setProcessing(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: "LaundryEase",
        description: "Booking Fee",
        order_id: data.id,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // 2. Verify Payment
          try {
            const verifyRes = await fetch(`/api/bookings/${booking._id}/pay`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              toast({
                title: "Payment successful!",
                description: "Booking fee has been paid",
                type: "success",
              });
              onRefresh();
            } else {
              toast({
                title: "Verification failed",
                description: "Payment could not be verified",
                type: "error",
              });
            }
          } catch (e) {
            console.error(e);
            toast({
              title: "Verification error",
              description: "An error occurred during verification",
              type: "error",
            });
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      // Razorpay is loaded via script tag
      interface RazorpayWindow {
        Razorpay: new (options: Record<string, unknown>) => {
          open: () => void;
        };
      }

      const rzp1 = new (window as unknown as RazorpayWindow).Razorpay(options);
      rzp1.open();
    } catch (e) {
      console.error(e);
      toast({
        title: "Payment error",
        description: "Failed to initialize payment",
        type: "error",
      });
      setProcessing(false);
    }
  }

  async function handleConfirmSlot() {
    if (!booking.pickupSlot?.dateTime) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          dateTime: booking.pickupSlot.dateTime,
        }),
      });
      if (res.ok) {
        toast({
          title: "Slot confirmed!",
          description: "The provider will arrive at the scheduled time",
          type: "success",
        });
        onRefresh();
      } else {
        const data = await res.json();
        toast({
          title: "Failed to confirm slot",
          description: data.message || "Please try again",
          type: "error",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to confirm slot. Please try again.",
        type: "error",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="group relative rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-lg hover:border-primary/20"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {/* Header Section */}
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-4">
             <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary shadow-sm">
                B
             </div>
             <div>
                <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  #{booking._id.toString().slice(-6).toUpperCase()}
                   <BookingStatusBadge status={booking.status} />
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                   <Calendar className="w-3.5 h-3.5" />
                   Created {new Date(booking.createdAt).toLocaleDateString()}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
             {booking.deadline && (
               <div className="rounded-xl bg-orange-500/10 p-3 text-orange-600 border border-orange-500/20">
                 <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">Deadline</p>
                 <div className="flex items-center gap-1.5 font-bold mt-1">
                   <Clock className="h-4 w-4" />
                   {new Date(booking.deadline).toLocaleDateString()}
                 </div>
               </div>
             )}
              <div className="rounded-xl bg-secondary p-3 border border-border/50">
                 <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 text-muted-foreground">Provider</p>
                 <div className="flex items-center gap-1.5 font-bold mt-1 text-foreground">
                   <User className="h-4 w-4" />
                   {booking.provider.name}
                 </div>
               </div>
          </div>
        </div>

        {/* Provider Contact */}
        <div className="w-full md:w-72 shrink-0 rounded-2xl bg-muted/30 p-4 border border-border/50 space-y-3">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Provider Details
          </h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            {booking.provider.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 opacity-70" />
                <span>{booking.provider.phone}</span>
              </div>
            )}
            {booking.provider.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 opacity-70 mt-1" />
                <span className="line-clamp-2">{booking.provider.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-6 border-t border-border/50 pt-4 space-y-4">
        {/* Booking Fee */}
        <div className="flex items-center justify-between rounded-xl bg-muted/20 p-4 border border-transparent hover:border-border transition-colors">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-border text-foreground">
                <IndianRupee className="w-4 h-4" />
             </div>
             <div>
                <p className="font-bold text-sm">Booking Fee (₹50)</p>
                <p className="text-xs text-muted-foreground">Required to process order</p>
             </div>
          </div>
          
          {booking.bookingFeeStatus === "paid" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 border border-green-500/20">
              <CheckCircle className="h-3.5 w-3.5" /> Paid
            </span>
          ) : booking.status === "rejected" || booking.status === "cancelled" ? (
            <span className="text-xs font-medium text-muted-foreground italic">
              Refunded/Void
            </span>
          ) : (
            <button
              onClick={handlePayBookingFee}
              disabled={processing}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {processing ? "Starting Payment..." : "Pay Now"}
            </button>
          )}
        </div>

        {/* Pickup Slot Action */}
        {booking.status === "pickup_proposed" && booking.pickupSlot && (
          <motion.div 
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: 'auto' }}
             className="rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" /> Action Required: Confirm Slot
                </h4>
                <p className="text-sm text-foreground">
                  Proposed: <strong>{new Date(booking.pickupSlot.dateTime).toLocaleString()}</strong>
                </p>
              </div>
              <button
                onClick={handleConfirmSlot}
                disabled={processing}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {processing ? "Confirming..." : "Confirm Slot"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {booking.status === "confirmed" && booking.pickupSlot && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-500/10 p-3 rounded-xl border border-green-500/20">
            <CheckCircle className="h-4 w-4" />
            Pickup confirmed for <strong>{new Date(booking.pickupSlot.dateTime).toLocaleString()}</strong>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const SeekerBookingCard = memo(SeekerBookingCardComponent);
