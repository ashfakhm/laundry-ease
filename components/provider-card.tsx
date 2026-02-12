"use client";

import { Star, MapPin, Sparkles } from "lucide-react";
import { BookingModal } from "@/components/booking-modal";
import { ProviderSearchResult } from "@/types/users";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function ProviderCard({ provider }: { provider: ProviderSearchResult }) {
  const router = useRouter();

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-6 hover:shadow-xl hover:border-primary/50 transition-all duration-300">
      {/* Header with Logo, Name, and Rating Badge */}
      <div className="flex items-start justify-between gap-3 mb-4 w-full overflow-hidden">
        {/* Left: Logo and Name */}
        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
          {/* Circular Logo */}
          <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
            {provider.profilePicture ? (
              <Image
                src={provider.profilePicture}
                alt={provider.businessName || provider.name}
                width={48}
                height={48}
                className="rounded-full object-cover"
              />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>

          {/* Provider Name */}
          <div className="min-w-0 flex-1 overflow-hidden">
            <h3 className="font-heading font-bold text-xl text-foreground truncate">
              {provider.businessName || provider.name}
            </h3>
          </div>
        </div>

        {/* Right: Rating Badge */}
        <div className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 whitespace-nowrap">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-foreground">
            {provider.rating.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <span className="line-clamp-2">{provider.location}</span>
      </div>

      {/* Service Tags */}
      {provider.services && provider.services.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {provider.services.slice(0, 3).map((service, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-md bg-secondary/50 text-secondary-foreground text-xs font-medium border border-border"
            >
              {service}
            </span>
          ))}
        </div>
      )}

      {/* BASE PRICE and RADIUS - Prominent Display */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-muted/30 border border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            BASE PRICE
          </p>
          <p className="text-2xl font-bold text-foreground">
            ₹{provider.pricing || 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">
            RADIUS
          </p>
          <p className="text-2xl font-bold text-foreground">
            {provider.radius_km || 10} km
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push(`/seeker/provider/${provider._id}`)}
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-primary/50 bg-background text-foreground font-semibold text-sm hover:bg-primary/5 hover:border-primary transition-all duration-200"
        >
          View Details
        </button>
        <div className="flex-1">
          <BookingModal provider={provider} />
        </div>
      </div>
    </div>
  );
}
