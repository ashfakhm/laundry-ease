"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { ProviderSearchResult } from "@/types/provider";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function BookingModal({ provider }: { provider: ProviderSearchResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleBooking() {
    if (!date) {
      toast.error("Please select a deadline date");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: provider._id,
          deadline: new Date(date).toISOString(),
          // MVP: Mock Seeker Coordinates at Provider location for now
          seeker_coordinates: { lat: 12.97, lng: 77.59 }, 
        }),
      });

      if (!res.ok) {
        throw new Error("Booking failed");
      }

      toast.success("Booking requested! Waiting for provider approval.");
      setIsOpen(false);
      router.push("/seeker/bookings");
    } catch (error) {
      toast.error("Failed to create booking");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25"
      >
        Book Now
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6 relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <h2 className="text-xl font-bold mb-2 pr-8 text-foreground">Book {provider.businessName}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Set your required deadline and pay the booking fee.
        </p>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Deadline Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              required
            />
            <p className="text-xs text-muted-foreground">
              When do you need the clothes back?
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-xl space-y-2 border border-border/50">
            <div className="flex justify-between text-sm text-foreground">
              <span>Booking Fee</span>
              <span>₹{provider.pricing ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border mt-2 text-foreground">
              <span>Total to Pay</span>
              <span>₹{provider.pricing ?? 0}</span>
            </div>
          </div>

          <button
            onClick={handleBooking}
            disabled={isSubmitting || !date}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Pay & Request
          </button>
        </div>
      </div>
    </div>
  );
}
