"use client";

// re-compile trigger
import { memo, useState, useEffect } from "react";
import {
  ConfirmDialog,
  useConfirmDialog,
} from "@/components/ui/confirm-dialog";
import { PopulatedSeekerBooking } from "@/types/bookings";
import { BookingStatusBadge } from "@/app/(dashboard)/provider/manage-booking/booking-status-badge";
import {
  Calendar,
  MapPin,
  Phone,
  IndianRupee,
  CheckCircle,
  Clock,
  ArrowRight,
  Trash2,
  FileText,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { reportError } from "@/lib/client-error";
import { formatDateKey } from "@/lib/date-key";
import { SEEKER_FREE_CANCEL_WINDOW_MS } from "@/lib/constants";

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
  const { showConfirm, dialogProps } = useConfirmDialog();

  // ── Cancel-window countdown ────────────────────────────────────────────────
  // Recompute every 10 s so the badge stays fresh without hammering the browser.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const bookingCreatedMs = booking.createdAt
    ? new Date(booking.createdAt as string | Date).getTime()
    : 0;
  const elapsedMs = bookingCreatedMs > 0 ? now - bookingCreatedMs : Infinity;
  const remainingMs = SEEKER_FREE_CANCEL_WINDOW_MS - elapsedMs;
  const withinFreeWindow = remainingMs > 0;
  const pickupSlotMs = booking.pickupSlot?.dateTime
    ? new Date(booking.pickupSlot.dateTime).getTime()
    : NaN;
  const beforePickupSlot = Number.isNaN(pickupSlotMs) || now < pickupSlotMs;
  const canCancelRequest =
    // invoice_created: provider already collected items — always cancellable
    // (pickup slot has passed by definition, so bypass the beforePickupSlot guard)
    booking.status === "invoice_created" ||
    ([
      "requested",
      "accepted",
      "pickup_proposed",
      "reschedule_requested",
      "confirmed",
    ].includes(booking.status) &&
      beforePickupSlot);
  const providerCancellationReason =
    booking.status === "cancelled" &&
    booking.cancelledBy === "provider" &&
    typeof booking.cancellation_reason === "string"
      ? booking.cancellation_reason.trim()
      : "";

  /** Human-readable "Xh Ym" or "Xm" remaining string. */
  function formatRemaining(ms: number): string {
    const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

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
      const json = await res.json();

      if (!res.ok) {
        toast({
          title: "Payment failed",
          description: json.message || "Failed to initiate payment",
          type: "error",
        });
        setProcessing(false);
        return;
      }

      // successResponse wraps payload inside `data` key:
      // { success, ok, data: { id, amount, currency } }
      const orderData = json.data ?? json;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LaundryEase",
        description: "Booking Fee",
        order_id: orderData.id,
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
              const verifyData = await verifyRes.json().catch(() => null);
              toast({
                title: "Verification failed",
                description:
                  verifyData?.message ||
                  verifyData?.data?.message ||
                  "Payment could not be verified. Please contact support.",
                type: "error",
              });
            }
          } catch (e) {
            reportError("PaymentVerificationError", e);
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
      reportError("PaymentInitError", e);
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
      reportError("SlotConfirmationError", e);
      toast({
        title: "Error",
        description: "Failed to confirm slot. Please try again.",
        type: "error",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleRequestReschedule() {
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/bookings/${booking._id}/reschedule/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (res.ok) {
        toast({
          title: "Reschedule requested",
          description: "Waiting for the provider to propose a new pickup time.",
          type: "info",
        });
        onRefresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      toast({
        title: "Failed to request reschedule",
        description:
          data?.error?.message || data?.message || "Please try again",
        type: "error",
      });
    } catch (e: unknown) {
      toast({
        title: "Failed to request reschedule",
        description: e instanceof Error ? e.message : "Please try again",
        type: "error",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <ConfirmDialog {...dialogProps} />
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
              {/* Provider Profile Picture */}
              <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-border bg-muted shadow-lg shrink-0">
                {booking.provider.profilePicture ? (
                  <Image
                    src={booking.provider.profilePicture}
                    alt={booking.provider.name}
                    fill
                    sizes="56px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center font-bold text-primary-foreground text-xl">
                    {booking.provider.businessName?.charAt(0) ||
                      booking.provider.name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-heading font-bold text-xl text-foreground flex items-center gap-3">
                  <span className="tracking-tight">
                    {booking.provider.businessName || booking.provider.name}
                  </span>
                  <BookingStatusBadge status={booking.status} />
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 font-medium">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 opacity-70" />
                    {new Date(booking.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-border"></div>
                  <div className="font-mono opacity-70">
                    #{booking._id.toString().slice(-6).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {booking.deadline && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2 text-orange-600 border border-orange-500/20 shadow-sm">
                  <Clock className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 leading-none mb-0.5">
                      Due By
                    </p>
                    <p className="text-xs font-bold">
                      {new Date(booking.deadline).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {booking.pickupSlot && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-blue-600 border border-blue-500/20 shadow-sm">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-70 leading-none mb-0.5">
                      Pickup
                    </p>
                    <p className="text-xs font-bold">
                      {new Date(booking.pickupSlot.dateTime).toLocaleString(
                        [],
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {booking.provider.availability?.isCurrentlyOnLeave && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
                Provider is currently on leave
                {booking.provider.availability.activeLeaveEndDate
                  ? ` until ${formatDateKey(booking.provider.availability.activeLeaveEndDate)}.`
                  : "."}{" "}
                Your existing booking remains active.
              </div>
            )}
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
                  <span className="line-clamp-2 leading-relaxed text-muted-foreground text-xs">
                    {booking.provider.address}
                  </span>
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
                  <p className="text-xs text-muted-foreground">
                    Service deposit required (₹{booking.bookingFee ?? 0})
                  </p>
                </div>
              </div>

              {booking.bookingFeeStatus === "paid" ||
              booking.bookingFeeStatus === "applied" ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-xl text-green-600 font-bold border border-green-500/20">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white p-1">
                    <CheckCircle className="w-full h-full" strokeWidth={3} />
                  </div>
                  <span className="text-sm">
                    {booking.bookingFeeStatus === "applied"
                      ? "Released"
                      : "Paid"}
                  </span>
                </div>
              ) : booking.status === "rejected" ||
                booking.status === "cancelled" ? (
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide bg-muted px-3 py-1 rounded-lg">
                  Cancelled
                </span>
              ) : (
                <button
                  onClick={handlePayBookingFee}
                  disabled={processing}
                  className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-lg hover:bg-foreground/90 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {processing
                    ? "Processing..."
                    : `Pay ₹${booking.bookingFee ?? 0}`}
                </button>
              )}
            </div>

            {/* Pickup Slot Action */}
            {booking.status === "pickup_proposed" && booking.pickupSlot && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Action Required
                    </h4>
                    <p className="text-sm text-foreground/80">
                      Provider proposed pickup:{" "}
                      <strong className="text-foreground">
                        {new Date(booking.pickupSlot.dateTime).toLocaleString()}
                      </strong>
                    </p>
                  </div>
                  <button
                    onClick={handleConfirmSlot}
                    disabled={processing}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 transition-all disabled:opacity-50"
                  >
                    {processing ? "Confirming..." : "Confirm Slot"}{" "}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={handleRequestReschedule}
                    disabled={processing}
                    className="text-xs font-bold text-foreground hover:text-primary bg-background hover:bg-primary/5 border border-border px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Request Reschedule
                  </button>
                </div>
              </motion.div>
            )}

            {booking.status === "reschedule_requested" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse mt-2 shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-700">
                      {booking.reschedule?.requestedBy === "seeker"
                        ? "You requested a reschedule"
                        : "Provider requested a reschedule"}
                    </h4>
                    <p className="text-sm text-foreground/80">
                      {booking.reschedule?.requestedBy === "seeker"
                        ? "Waiting for the provider to propose a new pickup time."
                        : "The provider needs to change the pickup time. A new slot will be proposed shortly."}
                    </p>
                    {booking.reschedule?.reason && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        Reason:{" "}
                        <span className="font-medium not-italic text-foreground/70">
                          {booking.reschedule.reason}
                        </span>
                      </p>
                    )}
                    {booking.reschedule?.previousPickupSlot?.dateTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Previous slot:{" "}
                        <span className="font-medium text-foreground/70">
                          {new Date(
                            booking.reschedule.previousPickupSlot.dateTime,
                          ).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </p>
                    )}
                    {(booking.reschedule?.count ?? 0) > 1 && (
                      <p className="text-xs text-amber-600/80 font-medium mt-1">
                        Reschedule #{booking.reschedule?.count}
                      </p>
                    )}
                  </div>
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
                  <p className="text-emerald-600/80 text-xs">
                    Provider scheduled for{" "}
                    {new Date(booking.pickupSlot.dateTime).toLocaleString([], {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )}

            {booking.status === "confirmed" && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleRequestReschedule}
                  disabled={processing}
                  className="text-xs font-bold text-foreground hover:text-primary bg-background hover:bg-primary/5 border border-border px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  Request Reschedule
                </button>
              </div>
            )}

            {/* Invoice Payment Section */}
            {booking.status === "invoice_created" && booking.invoice && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border border-primary/10 bg-linear-to-b from-primary/5 to-card p-6 space-y-5 shadow-lg shadow-primary/5 ring-1 ring-primary/5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-heading font-bold text-xl text-primary flex items-center gap-2">
                      🧾 Invoice Ready
                    </h4>
                    <p className="text-primary/70 text-xs font-medium mt-1">
                      Review items and complete payment
                    </p>
                  </div>
                </div>

                <div className="bg-background rounded-xl border border-border p-4 space-y-2 text-sm">
                  {booking.invoice.items.slice(0, 3).map(
                    (
                      item: {
                        itemType: string;
                        quantity: number;
                        unitPrice: number;
                      },
                      i: number,
                    ) => (
                      <div
                        key={i}
                        className="flex justify-between items-center py-1 border-b border-border/50 last:border-0"
                      >
                        <span className="text-muted-foreground font-medium">
                          {item.itemType}{" "}
                          <span className="text-muted-foreground/60 text-xs">
                            ×{item.quantity}
                          </span>
                        </span>
                        <span className="font-mono text-foreground font-semibold">
                          ₹{item.quantity * item.unitPrice}
                        </span>
                      </div>
                    ),
                  )}
                  {booking.invoice.items.length > 3 && (
                    <p className="text-xs text-center text-muted-foreground pt-1 italic">
                      +{booking.invoice.items.length - 3} more items...
                    </p>
                  )}

                  {booking.invoice.delivery_charge !== undefined && booking.invoice.delivery_charge > 0 && (
                    <div className="flex justify-between items-center py-1 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                      <span>Delivery Charge</span>
                      <span className="font-mono">
                        +₹{booking.invoice.delivery_charge}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-dashed border-border flex justify-between items-center">
                    <span className="font-bold text-muted-foreground uppercase text-xs tracking-wider">
                      Total Due
                    </span>
                    <span className="font-heading font-black text-2xl text-primary">
                      ₹
                      {booking.invoice.total !== undefined
                        ? booking.invoice.total
                        : booking.invoice.items.reduce(
                            (
                              acc: number,
                              item: { quantity: number; unitPrice: number },
                            ) => acc + item.quantity * item.unitPrice,
                            0,
                          ) - (booking.invoice.discount ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/seeker/bookings/${booking._id}/invoice-review`}
                    className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" /> View Full Invoice
                  </Link>
                </div>
              </motion.div>
            )}

            {providerCancellationReason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/20"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">
                      Provider cancelled this booking
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600/80 dark:text-red-300/80">
                      Reason shared by provider
                    </p>
                    <p className="text-sm leading-relaxed text-red-700/90 dark:text-red-200">
                      {providerCancellationReason}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Cancel / Delete Actions */}
            <div className="mt-4 space-y-3">
              {canCancelRequest && (
                <div className="flex flex-col gap-2">
                  {/* Cancel-window policy badge */}
                  {booking.bookingFeeStatus === "paid" &&
                    (booking.status === "invoice_created" ? (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 dark:bg-red-950/20 dark:border-red-800/50">
                        <Clock className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                        <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                          The provider has collected your items and created an
                          invoice.{" "}
                          <span className="font-bold">
                            Your ₹{booking.bookingFee ?? 50} booking fee will be
                            forfeited
                          </span>{" "}
                          as compensation if you cancel now.
                        </p>
                      </div>
                    ) : withinFreeWindow ? (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 dark:bg-emerald-950/20 dark:border-emerald-800/50">
                        <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Free cancel window:{" "}
                          <span className="font-bold">
                            {formatRemaining(remainingMs)} remaining
                          </span>{" "}
                          — booking fee will be refunded if cancelled now.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 dark:bg-amber-950/20 dark:border-amber-700/50">
                        <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          Free cancel window expired — your{" "}
                          <span className="font-bold">
                            ₹{booking.bookingFee ?? 50} booking fee will be
                            forfeited
                          </span>{" "}
                          if you cancel now.
                        </p>
                      </div>
                    ))}

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const isInvoiceStage =
                          booking.status === "invoice_created";
                        const feeWarning =
                          booking.bookingFeeStatus === "paid"
                            ? isInvoiceStage
                              ? ` The provider has already collected your items and created an invoice. Your ₹${booking.bookingFee ?? 50} booking fee will be forfeited as compensation for their work.`
                              : !withinFreeWindow
                                ? ` Your ₹${booking.bookingFee ?? 50} booking fee will be forfeited — the 2-hour free-cancel window has passed.`
                                : " Your booking fee will be refunded."
                            : "";
                        showConfirm({
                          title: isInvoiceStage
                            ? "Cancel & Reject Invoice"
                            : "Cancel Booking",
                          message: `Are you sure you want to cancel this booking?${feeWarning}`,
                          confirmText:
                            isInvoiceStage ||
                            booking.bookingFeeStatus !== "paid"
                              ? isInvoiceStage
                                ? "Yes, Cancel (fee forfeited)"
                                : "Yes, Cancel"
                              : withinFreeWindow
                                ? "Yes, Cancel & Refund"
                                : "Yes, Cancel (fee forfeited)",
                          cancelText: "Keep Booking",
                          variant: "danger",
                          onConfirm: async () => {
                            setProcessing(true);
                            try {
                              const res = await fetch(
                                `/api/bookings/${booking._id}/cancel`,
                                { method: "POST" },
                              );
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.message);
                              toast({
                                title:
                                  booking.status === "invoice_created"
                                    ? "Booking Cancelled & Invoice Rejected"
                                    : "Booking Cancelled",
                                description:
                                  booking.bookingFeeStatus === "paid" &&
                                  booking.status !== "invoice_created" &&
                                  withinFreeWindow
                                    ? "Your booking fee will be refunded shortly."
                                    : booking.bookingFeeStatus === "paid" &&
                                        (booking.status === "invoice_created" ||
                                          !withinFreeWindow)
                                      ? `Your ₹${booking.bookingFee ?? 50} booking fee has been forfeited as compensation.`
                                      : undefined,
                                type: "success",
                              });
                              onRefresh();
                            } catch (e: unknown) {
                              toast({
                                title: "Error",
                                description:
                                  e instanceof Error
                                    ? e.message
                                    : "Please try again",
                                type: "error",
                              });
                            } finally {
                              setProcessing(false);
                            }
                          },
                        });
                      }}
                      disabled={processing}
                      className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {processing
                        ? "Cancelling..."
                        : booking.status === "invoice_created"
                          ? "Cancel & Reject Invoice"
                          : "Cancel Request"}
                    </button>
                  </div>
                </div>
              )}

              {(booking.status === "cancelled" ||
                booking.status === "rejected") && (
                <button
                  onClick={() => {
                    showConfirm({
                      title: "Delete from History",
                      message:
                        "This will permanently remove the booking from your history. This action cannot be undone.",
                      confirmText: "Yes, Delete",
                      cancelText: "Keep",
                      variant: "danger",
                      onConfirm: async () => {
                        setProcessing(true);
                        try {
                          const res = await fetch(
                            `/api/bookings/${booking._id}`,
                            {
                              method: "DELETE",
                            },
                          );
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.message);
                          toast({ title: "Booking Deleted", type: "success" });
                          onRefresh();
                        } catch (e: unknown) {
                          toast({
                            title: "Error",
                            description:
                              e instanceof Error
                                ? e.message
                                : "Please try again",
                            type: "error",
                          });
                        } finally {
                          setProcessing(false);
                        }
                      },
                    });
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
    </>
  );
}

export const SeekerBookingCard = memo(SeekerBookingCardComponent);
