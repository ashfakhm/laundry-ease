"use client";

import { useState } from "react";

import { Loader2, X, ArrowRight } from "lucide-react";
import { ProviderSearchResult } from "@/types/provider";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function BookingModal({ provider }: { provider: ProviderSearchResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<string>("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const router = useRouter();
  const minDeadlineValue = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  })();

  async function geocodeAddress(
    address: string
  ): Promise<{ lat: number; lng: number } | null> {
      setIsGeocoding(true);
      try {
        // Use Nominatim (OpenStreetMap) for free geocoding
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'LaundryEase/1.0 (your@email.com)' }
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const loc = data[0];
          return { lat: parseFloat(loc.lat), lng: parseFloat(loc.lon) };
        } else {
          toast.error("Could not geocode address");
          return null;
        }
      } catch (e) {
        toast.error("Geocoding failed");
        return null;
      } finally {
        setIsGeocoding(false);
      }
    }

  async function handleBooking() {
    if (!date) {
      toast.error("Please select a deadline date");
      return;
    }
    if (!address) {
      toast.error("Please enter your pickup address");
      return;
    }
    let seekerCoords = coords;
    if (!seekerCoords) {
      seekerCoords = await geocodeAddress(address);
      if (!seekerCoords) return;
      setCoords(seekerCoords);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: provider._id,
          deadline: new Date(date).toISOString(),
          seeker_coordinates: seekerCoords,
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
        className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2"
      >
        Book Now
        <ArrowRight className="h-4 w-4" />
      </button>
    );
  }

  // --- FAANG-level delivery logic ---
  // Assume provider.distance_km, provider.radius_km, provider.covers_beyond_radius are present
  let deliveryStatus: "free" | "warn" | "block" = "free";
  let deliveryMessage = "";
  const distance = provider.distance_km;
  const radius = provider.radius_km ?? 0;
  const covers = provider.covers_beyond_radius ?? false;
  let estimatedDeliveryCharge = 0;
  if (distance > radius) {
    if (covers) {
      deliveryStatus = "warn";
      // Calculate estimated delivery charge
      const perKmRate = provider.per_km_rate ?? 0;
      const extraDistance = Math.max(0, distance - radius);
      estimatedDeliveryCharge = Math.round(extraDistance * perKmRate);
      deliveryMessage = `Delivery charge will apply. Estimated: ₹${estimatedDeliveryCharge}`;
    } else {
      deliveryStatus = "block";
      deliveryMessage = "This provider does not deliver to your location.";
    }
  } else {
    deliveryStatus = "free";
    deliveryMessage = "Free delivery";
  }

  if (deliveryStatus === "block") {
    return (
      <button
        disabled
        className="w-full h-11 bg-muted text-muted-foreground font-semibold rounded-xl cursor-not-allowed opacity-60 border border-border"
        title="This provider does not deliver to your location"
      >
        {deliveryMessage}
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

        <h2 className="text-xl font-bold mb-2 pr-8 text-foreground">
          Book {provider.businessName}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Set your required deadline and pay the booking fee.
        </p>

        <div className="space-y-6">
          {deliveryStatus === "free" && (
            <div className="bg-green-100 border border-green-400 text-green-800 rounded-xl p-3 text-sm flex items-center gap-2">
              <span className="font-bold">Free delivery</span>
            </div>
          )}
          {deliveryStatus === "warn" && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-xl p-3 text-sm flex items-center gap-2">
              <span className="font-bold">Note:</span> Delivery charge will
              apply. Estimated:{" "}
              <span className="font-bold">₹{estimatedDeliveryCharge}</span>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Pickup Address
            </label>
            <input
              type="text"
              value={address}
              onChange={async (e) => {
                setAddress(e.target.value);
                setCoords(null);
              }}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              placeholder="Enter your pickup address"
              required
            />
            <button
              type="button"
              className="btn btn-xs btn-outline mt-2"
              disabled={!address || isGeocoding}
              onClick={async () => {
                const c = await geocodeAddress(address);
                if (c) setCoords(c);
              }}
            >
              {isGeocoding
                ? "Locating..."
                : coords
                ? "Location Set"
                : "Detect Location"}
            </button>
            {coords && (
              <div className="text-xs text-green-700 mt-1">
                Location found: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Deadline Date
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDeadlineValue}
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
