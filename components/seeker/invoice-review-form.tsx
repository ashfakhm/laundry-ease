"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
}

export default function InvoiceReviewForm({
  invoice,
  bookingId,
}: InvoiceReviewFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate generic total if missing
  const displayedTotal =
    invoice.total !== undefined
      ? invoice.total
      : invoice.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  async function handleDecision(approved: boolean) {
    if(!confirm(approved ? "Approve invoice and create order?" : "Reject invoice and return clothes?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to submit decision");

      if (approved && data.orderId) {
        // Success: Redirect to the new Order Page
        router.push(`/seeker/orders/${data.orderId}`);
      } else {
        // Rejection: Redirect to dashboard or show status
        router.refresh();
        router.push("/dashboard/seeker?status=invoice_rejected");
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
                        <h3 className="font-bold text-foreground text-lg">{item.itemType}</h3>
                        <p className="text-sm text-muted-foreground">
                            {item.quantity} units × ₹{item.unitPrice}
                        </p>
                    </div>
                    <div className="text-right">
                         <p className="font-mono font-bold text-primary">₹{item.quantity * item.unitPrice}</p>
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Card */}
      <div className="p-6 bg-gradient-to-br from-card to-muted rounded-2xl border border-border shadow-lg space-y-3">
         {invoice.notes && (
             <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
                 <span className="font-bold block text-xs uppercase tracking-wider mb-1">Provider Notes:</span>
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
             <span className="font-heading font-black text-2xl text-primary">₹{displayedTotal}</span>
         </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error shadow-sm rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4 pt-2">
         <button
          onClick={() => handleDecision(false)}
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
             {loading ? <span className="loading loading-spinner"></span> : "Approve & Pay"}
         </button>
      </div>
      
      <p className="text-xs text-center text-muted-foreground mt-4">
          By approving, you agree to the total amount and condition of items shown.
      </p>
    </div>
  );
}
