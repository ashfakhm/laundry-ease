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
  Trash2,
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

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({
        title: "Configuration Error",
        description: "Payment gateway key missing. Please contact support.",
        type: "error",
      });
      setProcessing(false);
      return;
    }

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

  async function handlePayInvoice() {
    setProcessing(true);

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({
        title: "Configuration Error",
        description: "Payment gateway key missing",
        type: "error",
      });
      setProcessing(false);
      return;
    }

    try {
      // 1. Create Order
      const res = await fetch(`/api/bookings/${booking._id}/pay-invoice`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
            toast({
                title: "Gateway Authentication Failed",
                description: "The payment gateway keys are invalid. Please check your configuration.",
                type: "error"
            });
            throw new Error("Authentication failed");
        }
        throw new Error(data.error || "Failed to initiate payment");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: "LaundryEase",
        description: "Order Invoice Payment",
        order_id: data.id,
        handler: async function (response: any) {
          // 2. Verify Payment
          try {
            const verifyRes = await fetch(
              `/api/bookings/${booking._id}/pay-invoice`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              }
            );

            if (verifyRes.ok) {
              toast({
                title: "Payment Successful!",
                description: "Your order is now in progress.",
                type: "success",
              });
              onRefresh();
            } else {
              toast({
                title: "Verification Failed",
                description: "Could not verify payment.",
                type: "error",
              });
            }
          } catch (e) {
             toast({ title: "Error", description: "Verification error", type: "error" });
          }
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.open();
    } catch (e: any) {
      console.error(e);
      // Toast already shown for specific errors
      if (e.message !== "Authentication failed") {
         toast({
            title: "Payment Error",
            description: e.message || "Something went wrong",
            type: "error",
          });
      }
      setProcessing(false);
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="group relative rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/5 transition-all hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-0.5 overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <span className="font-heading text-8xl font-black text-foreground leading-none select-none">
          #{booking._id.toString().slice(-3).toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between relative z-10">
        {/* Header Section */}
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-5">
             <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center font-bold text-primary-foreground shadow-lg shadow-primary/30 text-xl">
                {booking.provider.name.charAt(0)}
             </div>
             <div>
                <h3 className="font-heading font-bold text-xl text-foreground flex items-center gap-3">
                  <span className="tracking-tight">{booking.provider.name}</span>
                   <BookingStatusBadge status={booking.status} />
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 font-medium">
                   <div className="flex items-center gap-1">
                     <Calendar className="w-3.5 h-3.5 opacity-70" />
                     {new Date(booking.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                   </div>
                   <div className="w-1 h-1 rounded-full bg-border"></div>
                   <div className="font-mono opacity-70">#{booking._id.toString().slice(-6).toUpperCase()}</div>
                </div>
             </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
             {booking.deadline && (
               <div className="inline-flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2 text-orange-600 border border-orange-500/20 shadow-sm">
                 <Clock className="h-4 w-4 shrink-0" />
                 <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 leading-none mb-0.5">Due By</p>
                    <p className="text-xs font-bold">{new Date(booking.deadline).toLocaleDateString()}</p>
                 </div>
               </div>
             )}
              
             {booking.pickupSlot && (
               <div className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-blue-600 border border-blue-500/20 shadow-sm">
                 <Calendar className="h-4 w-4 shrink-0" />
                 <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 leading-none mb-0.5">Pickup</p>
                    <p className="text-xs font-bold">{new Date(booking.pickupSlot.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Provider Contact */}
        <div className="w-full md:w-80 shrink-0 rounded-2xl bg-muted/30 p-5 border border-dashed border-border space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            PROVIDER CONTACT
          </h4>
          <div className="space-y-3 text-sm text-foreground font-medium">
            {booking.provider.phone && (
              <div className="flex items-center gap-3 group/link cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover/link:border-primary group-hover/link:text-primary transition-colors">
                    <Phone className="h-4 w-4" />
                </div>
                <span>{booking.provider.phone}</span>
              </div>
            )}
            {booking.provider.address && (
              <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground mt-1 shrink-0">
                    <MapPin className="h-4 w-4" />
                 </div>
                 <span className="line-clamp-2 leading-relaxed text-muted-foreground text-xs">{booking.provider.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-8 pt-6 border-t border-border relative">
        <div className="space-y-4">
        {/* Booking Fee */}
        <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-4 border border-border hover:border-primary/30 transition-colors group/fee">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border text-foreground shadow-sm group-hover/fee:scale-110 transition-transform">
                <IndianRupee className="w-5 h-5" />
             </div>
             <div>
                <p className="font-bold text-foreground">Booking Fee</p>
                <p className="text-xs text-muted-foreground">Service deposit required (₹{booking.bookingFee ?? 0})</p>
             </div>
          </div>
          
          {booking.bookingFeeStatus === "paid" ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-xl text-green-600 font-bold border border-green-500/20">
               <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white p-1">
                 <CheckCircle className="w-full h-full" strokeWidth={3} />
               </div>
               <span className="text-sm">Paid</span>
            </div>
          ) : booking.status === "rejected" || booking.status === "cancelled" ? (
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide bg-muted px-3 py-1 rounded-lg">
              Void
            </span>
          ) : (
            <button
              onClick={handlePayBookingFee}
              disabled={processing}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-lg hover:bg-foreground/90 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {processing ? "Processing..." : `Pay ₹${booking.bookingFee ?? 0}`}
            </button>
          )}
        </div>

        {/* Pickup Slot Action */}
        {booking.status === "pickup_proposed" && booking.pickupSlot && (
          <motion.div 
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: 'auto' }}
             className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Action Required
                </h4>
                <p className="text-sm text-foreground/80">
                  Provider proposed pickup: <strong className="text-foreground">{new Date(booking.pickupSlot.dateTime).toLocaleString()}</strong>
                </p>
              </div>
              <button
                onClick={handleConfirmSlot}
                disabled={processing}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 transition-all disabled:opacity-50"
              >
                {processing ? "Confirming..." : "Confirm Slot"} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {booking.status === "confirmed" && booking.pickupSlot && (
          <div className="flex items-center gap-3 text-sm font-medium text-emerald-600 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
             </div>
             <div>
               <p className="font-bold">Pickup Confirmed</p>
               <p className="text-emerald-600/80 text-xs">Provider scheduled for {new Date(booking.pickupSlot.dateTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p>
             </div>
          </div>
        )}

        {/* Invoice Payment Section */}
        {booking.status === "invoice_created" && booking.invoice && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
               className="rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/5 to-card p-6 space-y-5 shadow-lg shadow-primary/5 ring-1 ring-primary/5"
             >
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-heading font-bold text-xl text-primary flex items-center gap-2">
                           🧾 Invoice Ready
                        </h4>
                        <p className="text-primary/70 text-xs font-medium mt-1">Review items and complete payment</p>
                    </div>
                </div>
                
                <div className="bg-background rounded-xl border border-border p-4 space-y-2 text-sm">
                    {booking.invoice.items.slice(0, 3).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                            <span className="text-muted-foreground font-medium">{item.itemType} <span className="text-muted-foreground/60 text-xs">×{item.quantity}</span></span>
                            <span className="font-mono text-foreground font-semibold">₹{item.quantity * item.unitPrice}</span>
                        </div>
                    ))}
                    {booking.invoice.items.length > 3 && (
                        <p className="text-xs text-center text-muted-foreground pt-1 italic">+{booking.invoice.items.length - 3} more items...</p>
                    )}
                    
                    <div className="mt-4 pt-3 border-t border-dashed border-border flex justify-between items-center">
                        <span className="font-bold text-muted-foreground uppercase text-xs tracking-wider">Total Due</span>
                        <span className="font-heading font-black text-2xl text-primary">
                             ₹{booking.invoice.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0)}
                        </span>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={handlePayInvoice}
                        disabled={processing}
                        className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                        {processing ? <span className="loading loading-spinner loading-sm text-primary-foreground"></span> : <><ShieldCheck className="w-5 h-5" /> Pay & Start Order</>}
                    </button>
                    <p className="text-[10px] text-center mt-3 text-muted-foreground font-medium">
                        Payment protected by LaundryEase Escrow
                    </p>
                </div>
             </motion.div>
        )}
      {/* Cancel / Delete Actions */}
      <div className="mt-4 flex justify-end gap-3">
         {(booking.status === "requested" || booking.status === "pickup_proposed") && (
            <button
                onClick={async () => {
                    if(!confirm("Are you sure you want to cancel this booking?")) return;
                    setProcessing(true);
                    try {
                        const res = await fetch(`/api/bookings/${booking._id}/cancel`, { method: "POST" });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message);
                        toast({ title: "Booking Cancelled", type: "success" });
                        onRefresh();
                    } catch(e: any) {
                        toast({ title: "Error", description: e.message, type: "error" });
                    } finally {
                        setProcessing(false);
                    }
                }}
                disabled={processing}
                className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
                {processing ? "Cancelling..." : "Cancel Request"}
            </button>
         )}

         {(booking.status === "cancelled" || booking.status === "rejected") && (
            <button
                onClick={async () => {
                    if(!confirm("This will permanently remove the booking from your history. Continue?")) return;
                    setProcessing(true);
                    try {
                        const res = await fetch(`/api/bookings/${booking._id}`, { method: "DELETE" });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message);
                        toast({ title: "Booking Deleted", type: "success" });
                        onRefresh();
                    } catch(e: any) {
                        toast({ title: "Error", description: e.message, type: "error" });
                    } finally {
                        setProcessing(false);
                    }
                }}
                disabled={processing}
                className="text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors flex items-center gap-1 disabled:opacity-50"
            >
                <Trash2 className="w-3.5 h-3.5" />
                {processing ? "Deleting..." : "Delete from History"}
            </button>
         )}
      </div>

      </div>
      </div>
    </motion.div>
  );
}

export const SeekerBookingCard = memo(SeekerBookingCardComponent);
