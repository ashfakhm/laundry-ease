"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin,
  Star,
  Phone,
  Mail,
  Clock,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

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
  bio?: string;
  description?: string;
  businessName?: string;
  pricingRates?: Record<string, number>;
  createdAt?: string;
};

type Review = {
  _id: string;
  seeker_name: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviderDetails() {
      try {
        const response = await fetch(`/api/providers/${providerId}`);
        if (response.ok) {
          const data = await response.json();
          setProvider(data);
        } else {
          console.error("Provider not found");
        }
      } catch (error) {
        console.error("Error fetching provider:", error);
      } finally {
        setLoading(false);
      }
    }

    // Mock reviews for now (will be replaced with real API)
    setReviews([
      {
        _id: "1",
        seeker_name: "Rahul Sharma",
        rating: 5,
        comment:
          "Excellent service! Very professional and clothes came back perfectly clean.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: "2",
        seeker_name: "Priya Patel",
        rating: 4,
        comment: "Good quality work. Delivery was on time. Will use again.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: "3",
        seeker_name: "Amit Kumar",
        rating: 5,
        comment:
          "Best laundry service in the area! Very careful with delicate fabrics.",
        createdAt: new Date(
          Date.now() - 10 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ]);

    fetchProviderDetails();
  }, [providerId]);

  async function handleBookProvider() {
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
      });

      if (response.ok) {
        alert("Booking request sent successfully!");
        router.push("/seeker/view-orders");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to create booking");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("An error occurred. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="mt-4 text-sm text-muted-foreground">
              Loading provider details...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!provider) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
            <h2 className="text-xl font-semibold">Provider not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This provider may have been removed or doesn&apos;t exist.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Provider Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white">
                      {provider.name?.charAt(0) || "P"}
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold">
                        {provider.name || "Provider"}
                      </h1>
                      {provider.businessName && (
                        <p className="text-sm text-muted-foreground">
                          {provider.businessName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      <span>{provider.location || "Location not set"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                      <span className="font-medium text-foreground">
                        {averageRating.toFixed(1)}
                      </span>
                      <span>({reviews.length} reviews)</span>
                    </div>
                    {provider.createdAt && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                          Member since{" "}
                          {new Date(provider.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", year: "numeric" }
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 sm:flex-col sm:items-end">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      ₹{provider.pricing || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Starting price
                    </p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {provider.bio && (
                <div className="mt-6 rounded-xl bg-muted/50 p-4">
                  <p className="text-sm leading-relaxed">{provider.bio}</p>
                </div>
              )}
            </div>

            {/* About & Description */}
            <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
              <h2 className="text-lg font-semibold">About this Provider</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {provider.description ||
                  "This provider offers professional laundry services with attention to detail and quality. All items are handled with care using premium detergents and modern equipment."}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-background p-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">Quality Assured</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Premium service standards
                  </p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                    <p className="text-sm font-semibold">Fast Turnaround</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    24-48 hour delivery
                  </p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <MapPin className="h-5 w-5" />
                    <p className="text-sm font-semibold">Service Coverage</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {provider.radius_km || 10} km radius
                  </p>
                </div>
              </div>
            </div>

            {/* Services Offered */}
            <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
              <h2 className="text-lg font-semibold">Services Offered</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {provider.services && provider.services.length > 0 ? (
                  provider.services.map((service, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border bg-background p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{service}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No services listed
                  </p>
                )}
              </div>
            </div>

            {/* Pricing Rates */}
            {provider.pricingRates &&
              Object.keys(provider.pricingRates).length > 0 && (
                <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
                  <h2 className="text-lg font-semibold">Pricing Details</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {Object.entries(provider.pricingRates).map(
                      ([item, rate]) => (
                        <div
                          key={item}
                          className="flex items-center justify-between rounded-xl border bg-background p-4"
                        >
                          <p className="font-medium capitalize">{item}</p>
                          <p className="text-lg font-semibold text-emerald-600">
                            ₹{rate}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Reviews */}
            <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Customer Reviews</h2>
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5">
                  <Star className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">
                    {averageRating.toFixed(1)} / 5
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review._id}
                    className="rounded-xl border bg-background p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{review.seeker_name}</p>
                        <div className="mt-1 flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < review.rating
                                  ? "fill-emerald-500 text-emerald-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Booking Card (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-3xl border bg-card/80 p-6 shadow-lg backdrop-blur">
              <h3 className="text-lg font-semibold">Book This Provider</h3>

              {/* Service Radius */}
              <div className="mt-4 rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Service Coverage
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {provider.radius_km || 10} km
                </p>
                {provider.per_km_rate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ₹{provider.per_km_rate}/km beyond radius
                  </p>
                )}
              </div>

              {/* Contact Info */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{provider.phone || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{provider.email}</span>
                </div>
              </div>

              {/* Pricing Info */}
              <div className="mt-6 rounded-xl border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Starting Price
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">
                  ₹{provider.pricing || "N/A"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Final price based on items
                </p>
              </div>

              {/* Book Button */}
              <button
                onClick={handleBookProvider}
                className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Book Now
              </button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Payment after invoice approval
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
