"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CreditCard, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { RAZORPAY_CHECKOUT_SCRIPT_URL } from "@/lib/constants";
import { reportError } from "@/lib/client-error";
import type { RazorpayResponse, RazorpayError } from "@/types/razorpay";

interface PaymentButtonProps {
  orderId: string;
  amount: number;
  currency?: string;
  className?: string; // Added to fix lint errors and allow customization
  fullWidth?: boolean;
}

export function PaymentButton({
  orderId,
  amount,
  currency = "INR",
  className,
  fullWidth = true,
}: PaymentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handlePayment() {
    setLoading(true);
    try {
      // 1. Create Order on Backend
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok)
        throw new Error(data.error?.message || "Failed to initiate payment");

      // 2. Open Razorpay
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency ?? currency,
        name: "LaundryEase",
        description: `Payment for Order #${orderId.slice(-6)}`,
        order_id: data.id,
        handler: async function (response: RazorpayResponse) {
          // 3. Verify Payment
          const verifyRes = await fetch(`/api/orders/${orderId}/payment`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (verifyRes.ok) {
            toast.success("Payment Successful!");
            router.refresh(); // Refresh to update UI to 'Paid'
          } else {
            toast.error("Payment Verification Failed. Please contact support.");
          }
        },
        prefill: {
          name: "LaundryEase Customer",
        },
        theme: {
          color: "#7C3AED", // Primary Color
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: RazorpayError) {
        toast.error(
          response.error.description || "Payment failed. Please try again.",
        );
      });
      rzp.open();
    } catch (error) {
      reportError("PaymentInitError", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script src={RAZORPAY_CHECKOUT_SCRIPT_URL} />
      <button
        onClick={handlePayment}
        disabled={loading}
        className={cn(
          "group relative overflow-hidden rounded-xl font-bold transition-all duration-300",
          "bg-linear-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/25",
          "hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0",
          fullWidth ? "w-full" : "w-auto px-6",
          "py-3", // Consistent height
          className,
        )}
      >
        {/* Shimmer Effect */}
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative flex items-center justify-center gap-2.5">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <div className="p-1 rounded bg-white/20 backdrop-blur-sm">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">Pay Securely</span>
              <span className="ml-1 text-base font-heading">
                ₹{amount.toLocaleString("en-IN")}
              </span>
              <Lock className="w-3.5 h-3.5 text-white/70 ml-1" />
            </>
          )}
        </div>
      </button>
    </>
  );
}
