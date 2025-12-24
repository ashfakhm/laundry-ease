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
  Loader2,
  ShieldCheck,
  Package,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  seeker?: { name: string };
  rating: number;
  comment: string;
  createdAt: string;
};

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    async function fetchProviderDetails() {
      try {
        if (!providerId) {
          setLoading(false);
          return;
        }

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

    // Fetch reviews from API
    async function fetchReviews() {
      try {
        const res = await fetch(`/api/reviews?provider_id=${providerId}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        setReviews([]);
      }
    }
    fetchReviews();

    fetchProviderDetails();
  }, [providerId]);

  async function handleBookProvider() {
    if (booking) return;
    setBooking(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
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
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Fetching details...
          </p>
        </motion.div>
      </main>
    );
  }

  if (!provider) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold font-heading">
            Provider Unavailable
          </h2>
          <p className="mt-2 text-muted-foreground">
            This provider profile is no longer active or could not be found.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-8 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </button>
        </div>
      </main>
    );
  }

  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0;

  return (
    <main className="min-h-screen bg-background/50 p-6">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to Results
        </button>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Main Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 space-y-8"
          >
            {/* Header Card */}
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary shadow-inner">
                  {provider.name?.charAt(0) || "P"}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="font-heading text-3xl font-bold">
                        {provider.businessName || provider.name}
                      </h1>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-4 h-4" />
                        {provider.location}
                        <span className="text-border mx-1">|</span>
                        <span className="text-primary font-medium flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {averageRating.toFixed(1)} Rating
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Booking Price
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          ₹{provider.pricing || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {provider.bio && (
                    <p className="text-muted-foreground leading-relaxed pt-2">
                      {provider.bio}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    {provider.createdAt
                      ? new Date(provider.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", year: "numeric" }
                        )
                      : "Recently"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Radius</p>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {provider.radius_km || 10} km
                  </p>
                </div>
              </div>
            </div>

            {/* Services & Pricing */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm h-full">
                <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Services
                </h3>
                <div className="space-y-3">
                  {provider.services?.map((service, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-transparent hover:border-border transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="font-medium text-sm">{service}</span>
                    </div>
                  ))}
                  {!provider.services?.length && (
                    <p className="text-sm text-muted-foreground">
                      No services listed.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm h-full">
                <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Item Rates
                </h3>
                <div className="space-y-3">
                  {provider.pricingRates &&
                    Object.entries(provider.pricingRates).map(
                      ([item, rate], i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-border transition-colors"
                        >
                          <span className="font-medium text-sm text-muted-foreground">
                            {item}
                          </span>
                          <span className="font-bold text-foreground">
                            ₹{rate}
                          </span>
                        </div>
                      )
                    )}
                  {!provider.pricingRates && (
                    <p className="text-sm text-muted-foreground">
                      Contact for custom pricing.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold mb-4">
                About the Business
              </h3>
              <p className="text-muted-foreground text-sm leading-7">
                {provider.description || "No description provided."}
              </p>
            </div>

            {/* Reviews */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-lg font-bold">
                  Client Reviews
                </h3>
                <span className="text-xs font-bold bg-secondary px-3 py-1 rounded-full text-secondary-foreground">
                  {reviews.length} Verified Reviews
                </span>
              </div>

              <div className="grid gap-4">
                {reviews.map((review) => (
                  <div
                    key={review._id}
                    className="p-4 rounded-2xl bg-muted/20 border border-transparent hover:border-border transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {review.seeker?.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {review.seeker?.name || "User"}
                          </p>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "w-3 h-3",
                                  i < review.rating
                                    ? "fill-orange-400 text-orange-400"
                                    : "text-muted-foreground/30"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-10">
                      "{review.comment}"
                    </p>
                  </div>
                ))}
                {reviews.length === 0 && (
                   <p className="text-sm text-muted-foreground text-center py-4">No reviews yet.</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right Column - Sticky Booking Card */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-6 rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/5"
            >
              <div className="text-center mb-6">
                <h3 className="font-heading text-xl font-bold">
                  Book Provider
                </h3>
                <p className="text-sm text-muted-foreground">
                  Secure your slot now
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-sm font-medium text-muted-foreground">
                    Service Fee
                  </span>
                  <span className="font-bold">₹{provider.pricing}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-sm font-medium text-muted-foreground">
                    Escrow Protection
                  </span>
                  <span className="font-bold text-green-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Included
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium text-foreground">
                    {provider.phone}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="font-medium text-foreground truncate">
                    {provider.email}
                  </span>
                </div>
              </div>

              <button
                onClick={handleBookProvider}
                disabled={booking}
                className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {booking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Request Booking"
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                You won't be charged until the provider accepts your request.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
