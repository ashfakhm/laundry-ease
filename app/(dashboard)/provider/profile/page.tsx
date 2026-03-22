"use client";

import { ReviewsList } from "@/components/provider/reviews-list";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Star,
  Phone,
  Mail,
  Clock,
  Edit,
  CheckCircle2,
  TrendingUp,
  Package,
  Eye,
  Loader2,
  IndianRupee,
} from "lucide-react";
import { ProviderHeader } from "@/components/provider/provider-header";
import { reportError } from "@/lib/client-error";
import { unwrapApiData } from "@/lib/client-api";

type Provider = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  services: string[];
  pricing: number;
  radius_km?: number;
  free_radius_km?: number;
  per_km_rate?: number;
  bio?: string;
  description?: string;
  businessName?: string;
  pricingRates?: Record<string, number>;
  createdAt?: string;
  reviewCount?: number;
  rating?: number;
  profilePicture?: string;
  bannerImage?: string;
};

export default function ProviderProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviderProfile() {
      try {
        const response = await fetch("/api/profile/provider", {
          cache: "no-store",
        });
        if (response.ok) {
          const payload = await response.json();
          const data = unwrapApiData<Provider>(payload);
          setProvider(data);
        } else {
          reportError("ProviderProfileFetchError", "Failed to fetch provider profile");
        }
      } catch (error) {
        reportError("ProviderProfileFetchError", error);
      } finally {
        setLoading(false);
      }
    }

    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }

    fetchProviderProfile();
  }, [session, status]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Profile not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Unable to load your provider profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background/50 px-4 py-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header with Actions */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">My Profile</h1>
            <p className="text-sm text-muted-foreground">
              This is exactly how seekers see your profile
            </p>
          </div>
          <button
            onClick={() => router.push("/provider/profile/edit")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
          >
            <Edit className="h-4 w-4" />
            Edit Profile
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 items-start">
          {/* Left Column - Provider Info */}
          <div className="lg:col-span-2 space-y-8">
            <ProviderHeader provider={provider} />

            {/* 1. Header Card */}
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="font-heading text-3xl font-bold">
                        {provider.businessName || provider.name}
                      </h1>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-4 h-4" />
                        {provider.location || "Location not set"}
                        <span className="text-border mx-1">|</span>
                        <span className="text-primary font-medium flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {provider.rating
                            ? provider.rating.toFixed(1)
                            : "New"}{" "}
                          Rating
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    {provider.createdAt
                      ? new Date(provider.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", year: "numeric" },
                        )
                      : "Recently"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Service Radius
                  </p>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {provider.radius_km || 10} km
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Free Delivery</p>
                  <p className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {provider.free_radius_km || 5} km
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-primary" />
                    ₹{provider.per_km_rate || 10}/km
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Services & Pricing Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm h-full">
                <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Services
                </h3>
                <div className="space-y-3">
                  {provider.services && provider.services.length > 0 ? (
                    provider.services.map((service, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-transparent hover:border-border transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <span className="font-medium text-sm">{service}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No services listed yet.
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
                  Object.keys(provider.pricingRates).length > 0 ? (
                    Object.entries(provider.pricingRates).map(
                      ([item, rate], i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-border transition-colors"
                        >
                          <span className="font-medium text-sm text-muted-foreground capitalize">
                            {item}
                          </span>
                          <span className="font-bold text-foreground">
                            ₹{rate}
                          </span>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No custom rates set.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Description */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold mb-4">
                About the Business
              </h3>
              <p className="text-muted-foreground text-sm leading-7">
                {provider.description || "No description provided."}
              </p>
            </div>

            {/* 4. Reviews Section */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="font-heading text-lg font-bold">
                  Client Reviews
                </h3>
                {provider.reviewCount ? (
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                    {provider.reviewCount}
                  </span>
                ) : null}
              </div>
              <ReviewsList providerId={provider._id} />
            </div>
          </div>

          {/* Right Column - Contact Info (Static) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/5">
              <h3 className="font-heading text-lg font-bold flex items-center gap-2">
                Contact Information
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your public contact details
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-4">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{provider.email}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-4">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {provider.phone || "Not provided"}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-4">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {provider.location || "Location not set"}
                  </span>
                </div>
              </div>

              <div className="mt-8 rounded-xl bg-primary/5 p-4 border border-primary/10">
                <div className="flex items-center gap-2 text-primary">
                  <Eye className="h-4 w-4" />
                  <p className="text-sm font-bold">Public Preview</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  This page reflects exactly what seekers see when they visit
                  your profile. Use the &quot;Edit Profile&quot; button to
                  update any incorrect information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
