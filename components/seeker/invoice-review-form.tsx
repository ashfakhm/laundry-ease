"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { RAZORPAY_CHECKOUT_SCRIPT_URL } from "@/lib/constants";
import { reportError } from "@/lib/client-error";
import { unwrapApiData } from "@/lib/client-api";
import type { RazorpayResponse, RazorpayError } from "@/types/razorpay";

// Define strict types matching the API response
type InvoiceItem = {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string;
};

type Invoice = {
  items: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
  notes?: string;
};

interface InvoiceReviewFormProps {
  invoice: Invoice;
  bookingId: string;
  readOnly?: boolean;
}

export default function InvoiceReviewForm({
  invoice,
  bookingId,
  readOnly = false,
}: InvoiceReviewFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Calculate generic total if missing
  const displayedTotal =
    invoice.total !== undefined
      ? invoice.total
      : Math.max(
          0,
          invoice.items.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
          ) - (invoice.discount ?? 0),
        );

  async function handleDecision(approved: boolean, reason?: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reason: reason || "" }),
      });

      const raw = await res.json();

      if (!raw.ok)
        throw new Error(raw.error?.message || "Failed to submit decision");

      const data = unwrapApiData<{ orderId?: string; status?: string }>(raw);

      if (approved && data.orderId) {
        // Success: Initiate Payment Flow logic
        try {
          // 1. Create Order on Backend (Get Razorpay Order ID)
          const payRes = await fetch(`/api/orders/${data.orderId}/payment`, {
            method: "POST",
          });
          const payPayload = await payRes.json();

          if (!payRes.ok)
            throw new Error(
              payPayload.error?.message || "Failed to initiate payment",
            );

          console.log("🔍 Payment API Response (raw):", payPayload);

          const payData = unwrapApiData<{
            id: string;
            amount: number;
            currency: string;
            key: string;
          }>(payPayload);

          console.log("🔍 Payment Data (unwrapped):", payData);
          console.log("🔍 Amount being sent to Razorpay:", payData.amount);

          // 2. Open Razorpay
          const options = {
            key: payData.key,
            amount: payData.amount,
            currency: payData.currency,
            name: "LaundryEase",
            description: `Payment for Order #${data.orderId.slice(-6)}`,
            order_id: payData.id,
            handler: async function (response: RazorpayResponse) {
              // 3. Verify Payment
              const verifyRes = await fetch(
                `/api/orders/${data.orderId}/payment`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                },
              );

              if (verifyRes.ok) {
                toast.success("Payment Successful!");
                router.push(`/seeker/orders/${data.orderId}`); // Should show "Paid" status
              } else {
                const verifyData = await verifyRes.json();
                toast.error(
                  verifyData.error?.message ||
                    "Payment Verification Failed. Please contact support.",
                );
                router.push(`/seeker/orders/${data.orderId}`);
              }
            },
            prefill: {
              name: "LaundryEase Customer",
            },
            theme: {
              color: "#7C3AED",
            },
            modal: {
              ondismiss: function () {
                router.push(`/seeker/orders/${data.orderId}`);
              },
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", function (response: RazorpayError) {
            toast.error(
              response.error.description || "Payment failed. Please try again.",
            );
            router.push(`/seeker/orders/${data.orderId}`);
          });
          rzp.open();
        } catch (paymentError) {
          reportError("PaymentInitError", paymentError);
          // If payment init fails, just go to order page
          router.push(`/seeker/orders/${data.orderId}`);
        }
      } else {
        // Rejection: Redirect to Invoice List
        router.refresh();
        router.push("/seeker/invoices");
      }
    } catch (err: unknown) {
      let msg = "Unknown error";
      if (err && typeof err === "object" && "message" in err) {
        msg = (err as { message?: string }).message || msg;
      }
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Script src={RAZORPAY_CHECKOUT_SCRIPT_URL} />
      {/* Header Card */}
      <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border shadow-lg">
        <h2 className="text-xl font-heading font-bold mb-1">Invoice Details</h2>
        <p className="text-sm text-muted-foreground">
          Please review the items added by your provider.
        </p>
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {invoice.items.map((item, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row gap-4 p-4 bg-card rounded-xl border border-border/50 hover:border-primary/20 transition-all shadow-sm"
          >
            {/* Photo Evidence */}
            <div className="shrink-0">
              {item.photoUrl ? (
                <div className="relative w-full sm:w-24 h-32 sm:h-24 rounded-lg overflow-hidden border border-border bg-muted">
                  <Image
                    src={item.photoUrl}
                    alt={item.itemType}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full sm:w-24 h-24 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border">
                  No Photo
                </div>
              )}
            </div>

            {/* Item Details */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground text-lg">
                    {item.itemType}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} units × ₹{item.unitPrice}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-primary">
                    ₹{item.quantity * item.unitPrice}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Card */}
      <div className="p-6 bg-linear-to-br from-card to-muted rounded-2xl border border-border shadow-lg space-y-3">
        {invoice.notes && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
            <span className="font-bold block text-xs uppercase tracking-wider mb-1">
              Provider Notes:
            </span>
            {invoice.notes}
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">₹{invoice.subtotal}</span>
        </div>
        {invoice.discount ? (
          <div className="flex justify-between items-center text-sm text-green-500">
            <span>Discount</span>
            <span>- ₹{invoice.discount}</span>
          </div>
        ) : null}
        <div className="pt-3 border-t border-border flex justify-between items-center">
          <span className="font-heading font-bold text-lg">Total to Pay</span>
          <span className="font-heading font-black text-2xl text-primary">
            ₹{displayedTotal}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error shadow-sm rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!readOnly && (
        <>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => setShowRejectDialog(true)}
              disabled={loading}
              className="btn btn-outline btn-error h-14 rounded-xl font-bold border-2 hover:bg-error hover:text-white transition-all disabled:opacity-50"
            >
              Reject Invoice
            </button>

            <button
              onClick={() => handleDecision(true)}
              disabled={loading}
              className="btn btn-primary h-14 rounded-xl font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="loading loading-spinner"></span>
              ) : (
                "Approve & Pay"
              )}
            </button>
          </div>

          <div className="pt-4">
            <button
              onClick={() => router.back()}
              disabled={loading}
              className="btn btn-outline w-full h-12 rounded-xl font-medium border-2 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By approving, you agree to the total amount and condition of items
            shown.
          </p>
        </>
      )}

      {readOnly && (
        <div className="pt-4">
          <button
            onClick={() => router.back()}
            className="btn btn-outline w-full h-12 rounded-xl font-medium border-2 transition-all"
          >
            Back
          </button>
        </div>
      )}

      {/* Rejection Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRejectDialog}
        onClose={() => {
          setShowRejectDialog(false);
          setRejectionReason("");
        }}
        onConfirm={async () => {
          if (!rejectionReason.trim()) {
            toast.error("Please provide a reason for rejection");
            return;
          }
          setShowRejectDialog(false);
          await handleDecision(false, rejectionReason);
          setRejectionReason("");
        }}
        title="Reject Invoice?"
        message="This will return the clothes to the provider. Please provide a reason for rejection:"
        confirmText="Reject Invoice"
        cancelText="Cancel"
        variant="danger"
      >
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Enter reason for rejection..."
          className="w-full mt-4 rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
        />
      </ConfirmDialog>
    </div>
  );
}
