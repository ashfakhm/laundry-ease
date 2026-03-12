"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  Star,
  Loader2,
  Filter,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { useToast } from "@/components/ui/toast";
import { ProviderCardSkeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/client-error";
import { unwrapApiData } from "@/lib/client-api";

type Provider = {
  _id: string;
  name: string;
  businessName?: string;
  email: string;
  phone: string;
  location: string;
  services: string[];
  pricing: number;
  radius_km?: number;
  per_km_rate?: number;
  profilePicture?: string;
  bannerImage?: string;
  rating?: number;
  reviewCount?: number;
};

export default function SeekerDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(
    null,
  );
  const [searchLocation, setSearchLocation] = useState("");
  const [searchCoordinates, setSearchCoordinates] = useState<
    { lat: number; lng: number } | undefined
  >(undefined);
  const [searchName, setSearchName] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [seekerLocation, setSeekerLocation] = useState("");
  const [coordinates, setCoordinates] = useState<
    { lat: number; lng: number } | undefined
  >(undefined);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16);
  });

  const minDeadlineValue = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  })();

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, []);

  // Fetch seeker's location from profile
  useEffect(() => {
    async function fetchSeekerProfile() {
      try {
        if (session?.user?.email) {
          const response = await fetch(`/api/profile/seeker`, {
            cache: "no-store",
          });
          if (response.ok) {
            const payload = await response.json();
            const data = unwrapApiData<{
              address?: { city?: string };
              coordinates?: { lat?: number; lng?: number };
            }>(payload);
            if (data.address?.city) {
              const location = data.address.city;
              setSeekerLocation(location);
              setSearchLocation(location); // Auto-populate
            }
            if (
              typeof data.coordinates?.lat === "number" &&
              typeof data.coordinates?.lng === "number"
            ) {
              setSearchCoordinates({
                lat: data.coordinates.lat,
                lng: data.coordinates.lng,
              });
            }
          }
        }
      } catch (error) {
        reportError("SeekerProfileFetchError", error);
      }
    }
    fetchSeekerProfile();
  }, [session]);

  // Fetch providers
  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchLocation) params.append("location", searchLocation);
        if (searchCoordinates) {
          params.append("lat", searchCoordinates.lat.toString());
          params.append("lng", searchCoordinates.lng.toString());
        }
        if (searchName) params.append("name", searchName);
        if (selectedService) params.append("service", selectedService);
        if (deadline) params.append("deadline", deadline);

        const response = await fetch(`/api/providers?${params.toString()}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const payload = await response.json();
          const data = unwrapApiData<{ providers?: Provider[] }>(payload);
          setProviders(Array.isArray(data?.providers) ? data.providers : []);
        }
      } catch (error) {
        reportError("ProviderFetchError", error);
        toast({
          title: "Failed to load providers",
          description: "Please try again later",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchProviders();
  }, [
    searchLocation,
    searchCoordinates,
    searchName,
    selectedService,
    deadline,
    toast,
  ]);

  const popularServices = [
    "Wash",
    "Fold",
    "Dry Cleaning",
    "Ironing",
    "Shoe Cleaning",
    "Stain Removal",
    "Bedding & Linen",
    "Curtains & Drapes",
    "Premium Laundry",
    "Express Service",
  ];

  async function handleBookProvider(providerId: string) {
    if (bookingInProgress) return;
    if (!deadline) {
      toast({
        title: "Deadline required",
        description: "Please select a service deadline before booking.",
        type: "warning",
      });
      return;
    }

    setBookingInProgress(providerId);
    try {
      const response = await fetch("/api/bookings", {
        cache: "no-store",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          deadline: new Date(deadline).toISOString(),
          seeker_coordinates: coordinates,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Booking requested!",
          description: "Your booking request has been sent to the provider",
          type: "success",
        });
        router.push("/seeker/bookings");
      } else {
        toast({
          title: "Booking failed",
          description: data.error?.message || "Failed to create booking",
          type: "error",
        });
      }
    } catch (error) {
      reportError("BookingCreationError", error);
      toast({
        title: "Something went wrong",
        description: "Please check your connection and try again",
        type: "error",
      });
    } finally {
      setBookingInProgress(null);
    }
  }

  return (
    <main className="min-h-screen bg-background/50 p-6 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Find Laundry Providers
            </h1>
            <p className="mt-2 text-lg text-muted-foreground max-w-2xl">
              Discover trusted professionals near you for all your garment care
              needs.
            </p>
          </div>
        </motion.header>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-2xl p-4 md:p-6 shadow-sm space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-4">
            {/* Location Search */}
            <div className="relative group z-20">
              <LocationAutocomplete
                value={searchLocation}
                onChange={(val, coords) => {
                  setSearchLocation(val);
                  if (coords) {
                    setSearchCoordinates({ lat: coords.lat, lng: coords.lng });
                  } else {
                    setSearchCoordinates(undefined);
                  }
                }}
                placeholder={seekerLocation || "Search by location..."}
              />
            </div>

            {/* Name Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search by provider name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full h-11 rounded-xl border border-input bg-background pl-10 pr-4 text-sm shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Service Filter */}
            <div className="relative group">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full h-11 appearance-none rounded-xl border border-input bg-background pl-10 pr-4 text-sm shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
              >
                <option value="">All Services</option>
                {popularServices.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            {/* Deadline Input */}
            <div className="relative group">
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={minDeadlineValue}
                className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
              Popular:
            </span>
            {popularServices.slice(0, 4).map((service) => (
              <button
                key={service}
                onClick={() =>
                  setSelectedService(selectedService === service ? "" : service)
                }
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 border",
                  selectedService === service
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                    : "bg-background border-border hover:border-primary/50 hover:bg-muted",
                )}
              >
                {service}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results Grid */}
        <section aria-label="Provider search results">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProviderCardSkeleton key={i} />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-24 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6">
                <Search className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                No providers found
              </h3>
              <p className="mt-2 text-muted-foreground max-w-sm">
                {searchLocation
                  ? `We couldn't find any providers in ${searchLocation}. Try selecting from the location suggestions or adjusting your service type.`
                  : "Please select a location first. Click on the location field and choose from the suggestions."}
              </p>
              {searchLocation && (
                <p className="mt-3 text-sm text-muted-foreground">
                  💡 Tip: Make sure to select your location from the dropdown
                  suggestions for accurate results.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {providers.map((provider, i) => (
                  <motion.article
                    key={provider._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/20 overflow-hidden"
                  >
                    {/* Card Content */}
                    <div
                      onClick={() =>
                        router.push(`/seeker/provider/${provider._id}`)
                      }
                      className="cursor-pointer space-y-6"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Profile Picture */}
                          <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-border bg-muted shrink-0">
                            {provider.profilePicture ? (
                              <Image
                                src={provider.profilePicture}
                                alt={provider.name}
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                                {provider.businessName?.charAt(0) ||
                                  provider.name?.charAt(0) ||
                                  "P"}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {provider.businessName ||
                                provider.name ||
                                "Provider"}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {provider.location || "Location not set"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {provider.rating &&
                        provider.reviewCount &&
                        provider.reviewCount > 0 ? (
                          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-amber-500/20 shrink-0">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {provider.rating.toFixed(1)}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {provider.services
                            ?.slice(0, 3)
                            .map((service, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium"
                              >
                                {service}
                              </span>
                            ))}
                          {provider.services?.length > 3 && (
                            <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                              +{provider.services.length - 3} more
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-muted/30 p-3 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Base Price
                            </p>
                            <p className="text-base font-bold text-foreground mt-0.5">
                              ₹{provider.pricing || 0}
                            </p>
                          </div>
                          <div className="bg-muted/30 p-3 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Radius
                            </p>
                            <p className="text-base font-bold text-foreground mt-0.5">
                              {provider.radius_km || 10} km
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/seeker/provider/${provider._id}`);
                        }}
                        className="flex-1 h-10 rounded-xl border border-input bg-background font-medium text-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        View Details
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookProvider(provider._id);
                        }}
                        disabled={bookingInProgress === provider._id}
                        className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {bookingInProgress === provider._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Book Now <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
