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
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

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
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-100/50 dark:hover:border-emerald-900/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Header Section */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 dark:text-white">
              #{booking._id.toString().slice(-6).toUpperCase()}
            </h3>
            <BookingStatusBadge status={booking.status} />
          </div>

          <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                Created: {new Date(booking.createdAt).toLocaleDateString()}
              </span>
            </div>
            {booking.deadline && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                <ClockIcon className="h-4 w-4" />
                <span>
                  Deadline: {new Date(booking.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Provider Details */}
        <div className="w-full sm:w-72 shrink-0 rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4 text-sm border border-gray-100/50 dark:border-gray-700/50">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Provider Details
          </div>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {booking.provider.name}
              </span>
            </div>
            {booking.provider.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <span>{booking.provider.phone}</span>
              </div>
            )}
            {booking.provider.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 mt-0.5" />
                <span className="line-clamp-2">{booking.provider.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Area: Booking Fee */}
      <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
          <span className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <IndianRupee className="w-4 h-4 text-gray-500 dark:text-gray-400" />{" "}
            Booking Fee (₹50)
          </span>
          {booking.bookingFeeStatus === "paid" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" /> Paid
            </span>
          ) : booking.status === "rejected" ||
            booking.status === "cancelled" ? (
            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
              Fee Refunded/Void
            </span>
          ) : (
            <button
              onClick={handlePayBookingFee}
              disabled={processing}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {processing ? "..." : "Pay Now"}
            </button>
          )}
        </div>

        {/* Action Area: Pickup Slot */}
        {booking.status === "pickup_proposed" && booking.pickupSlot && (
          <div className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30 p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" /> Confirm Pickup Slot
            </h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Proposed:{" "}
                  <strong>
                    {new Date(booking.pickupSlot.dateTime).toLocaleString()}
                  </strong>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  Please confirm this time for the provider to arrive.
                </p>
              </div>
              <button
                onClick={handleConfirmSlot}
                disabled={processing}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {processing ? "..." : "Confirm Slot"}
              </button>
            </div>
          </div>
        )}

        {booking.status === "confirmed" && booking.pickupSlot && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
            <CheckCircle className="h-4 w-4" />
            Pickup confirmed for{" "}
            <strong>
              {new Date(booking.pickupSlot.dateTime).toLocaleString()}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export const SeekerBookingCard = memo(SeekerBookingCardComponent);
