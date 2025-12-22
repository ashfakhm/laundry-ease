"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

interface PaymentButtonProps {
  orderId: string;
  amount: number;
  currency?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PaymentButton({ orderId, amount, currency = "INR" }: PaymentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    setLoading(true);
    try {
      // 1. Create Order on Backend
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

      // 2. Open Razorpay
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "LaundryEase",
        description: `Payment for Order #${orderId.slice(-6)}`,
        order_id: data.id,
        handler: async function (response: any) {
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
            alert("Payment Successful!");
            router.refresh();
          } else {
             alert("Payment Verification Failed. Please contact support.");
          }
        },
        prefill: {
          name: "LaundryEase Customer", // In a real app, pass user email/phone
        },
        theme: {
          color: "#7C3AED", // Primary Color
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        alert(response.error.description);
      });
      rzp.open();

    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <button
        onClick={handlePayment}
        disabled={loading}
        className="btn btn-primary btn-sm rounded-lg font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-transform"
      >
        {loading ? (
             <span className="loading loading-spinner loading-xs"></span>
        ) : (
            `Pay ₹${amount}`
        )}
      </button>
    </>
  );
}
