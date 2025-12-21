"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Tag, Star, Phone, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ProviderCardSkeleton } from "@/components/ui/skeleton";

type Provider = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  services: string[];
  pricing: number;
  radius_km?: number;
  per_km_rate?: number;
};

export default function SeekerDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(
    null
  );
  const [searchLocation, setSearchLocation] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [seekerLocation, setSeekerLocation] = useState("");
  const [coordinates, setCoordinates] = useState<
    { lat: number; lng: number } | undefined
  >(undefined);

  // FAANG Practice: Get User Coordinates
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
          const response = await fetch(`/api/profile/seeker`);
          if (response.ok) {
            const data = await response.json();
            if (data.address?.city) {
              const location = data.address.city;
              setSeekerLocation(location);
              setSearchLocation(location); // Auto-populate
            }
          }
        }
      } catch (error) {
        console.error("Error fetching seeker profile:", error);
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
        if (searchName) params.append("name", searchName);
        if (selectedService) params.append("service", selectedService);

        const response = await fetch(`/api/providers?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
        }
      } catch (error) {
        console.error("Error fetching providers:", error);
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
  }, [searchLocation, searchName, selectedService, toast]);

  const popularServices = [
    "Wash & Fold",
    "Dry Cleaning",
    "Iron Only",
    "Wash & Iron",
    "Premium Care",
    "Express Service",
  ];

  async function handleBookProvider(providerId: string) {
    if (bookingInProgress) return;

    setBookingInProgress(providerId);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
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
          description: data.error || "Failed to create booking",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error creating booking:", error);
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
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Find Laundry Providers Near You
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by location, service type, or provider name to find the
              perfect laundry service
            </p>
          </div>

          {/* Search Filters */}
          <div className="grid gap-3 md:grid-cols-3">
            {/* Location Search */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={seekerLocation || "Search by location..."}
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* Name Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by provider name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* Service Filter */}
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full appearance-none rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">All Services</option>
                {popularServices.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Service Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Quick filters:
            </span>
            {popularServices.slice(0, 4).map((service) => (
              <button
                key={service}
                onClick={() =>
                  setSelectedService(selectedService === service ? "" : service)
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedService === service
                    ? "bg-emerald-500 text-white"
                    : "border bg-background hover:bg-muted"
                }`}
              >
                {service}
              </button>
            ))}
          </div>
        </header>

        {/* Results */}
        <section aria-label="Provider search results">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProviderCardSkeleton key={i} />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No providers found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your search filters or location
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => (
                <article
                  key={provider._id}
                  className="group rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur transition hover:shadow-md"
                >
                  {/* Clickable area to view profile */}
                  <div
                    onClick={() =>
                      router.push(`/seeker/provider/${provider._id}`)
                    }
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        router.push(`/seeker/provider/${provider._id}`);
                      }
                    }}
                  >
                    {/* Provider Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold group-hover:text-emerald-600 transition">
                          {provider.name || "Provider"}
                        </h3>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{provider.location || "Location not set"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                        <Star className="h-3 w-3 fill-emerald-500" />
                        <span>4.5</span>
                      </div>
                    </div>

                    {/* Services */}
                    <div className="mt-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        Services
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {provider.services && provider.services.length > 0 ? (
                          provider.services.slice(0, 3).map((service, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium"
                            >
                              {service}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No services listed
                          </span>
                        )}
                        {provider.services && provider.services.length > 3 && (
                          <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            +{provider.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pricing & Radius */}
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground">
                          Starting Price
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">
                          ₹{provider.pricing || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground">
                          Service Radius
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">
                          {provider.radius_km || 10} km
                        </p>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{provider.phone || "Not provided"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{provider.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/seeker/provider/${provider._id}`)
                      }
                      className="rounded-xl border bg-background py-2.5 text-sm font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookProvider(provider._id);
                      }}
                      disabled={bookingInProgress === provider._id}
                      className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bookingInProgress === provider._id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Booking...
                        </span>
                      ) : (
                        "Book Now"
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Results Count */}
        {!loading && providers.length > 0 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Showing {providers.length} provider
              {providers.length !== 1 ? "s" : ""}{" "}
              {searchLocation && `in ${searchLocation}`}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
