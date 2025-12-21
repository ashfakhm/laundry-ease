"use client";

import { Star, MapPin, Truck, IndianRupee } from "lucide-react";
import { BookingModal } from "@/components/booking-modal";
import { useState } from "react";

import { ProviderSearchResult } from "@/types/provider";

export function ProviderCard({ provider }: { provider: ProviderSearchResult }) {
  const [limitOpen, setLimitOpen] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-heading font-bold text-lg text-foreground">
            {provider.businessName || provider.name}
          </h3>
          <div className="flex items-center gap-1 text-amber-500 mt-1">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-semibold">{provider.rating}</span>
            <span className="text-xs text-muted-foreground ml-1">
              ({provider.reviewCount})
            </span>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
          {provider.distance_km.toFixed(1)} km
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
        {provider.bio || "No description provided."}
      </p>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="truncate">{provider.location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Truck className="h-4 w-4 text-emerald-500" />
          <span>
            Delivery:{" "}
            <span className="font-semibold text-foreground">
              {provider.delivery_fee === 0
                ? "Free"
                : `₹${provider.delivery_fee.toFixed(0)}`}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IndianRupee className="h-4 w-4 text-blue-500" />
            <span>
                Starts at: <span className="font-semibold text-foreground">₹{provider.pricing}</span>
            </span>
        </div>
      </div>

      <BookingModal provider={provider} />
    </div>
  );
}
