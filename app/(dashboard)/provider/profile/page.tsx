"use client";

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
  Eye,
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
  bio?: string;
  description?: string;
  businessName?: string;
  pricingRates?: Record<string, number>;
  createdAt?: string;
};

export default function ProviderProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviderProfile() {
      try {
        const response = await fetch("/api/profile/provider");
        if (response.ok) {
          const data = await response.json();
          setProvider(data);
        } else {
          console.error("Failed to fetch provider profile");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchProviderProfile();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
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
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        {/* Header with Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <p className="text-sm text-muted-foreground">
              This is how seekers see your profile
            </p>
          </div>
          <button
            onClick={() => router.push("/provider/profile/edit")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <Edit className="h-4 w-4" />
            Edit Profile
          </button>
        </div>

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
                      <h2 className="text-2xl font-semibold">
                        {provider.name || "Provider"}
                      </h2>
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
                      <span className="font-medium text-foreground">4.5</span>
                      <span>(New provider)</span>
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
                      ₹{provider.pricing ?? "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Booking Price
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
              <h3 className="text-lg font-semibold">About</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {provider.description ||
                  "This provider offers professional laundry services with attention to detail and quality."}
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
              <h3 className="text-lg font-semibold">Services Offered</h3>
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
                  <h3 className="text-lg font-semibold">Pricing Details</h3>
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
          </div>

          {/* Right Column - Contact Info */}
          <div className="space-y-6">
            {/* Contact Card */}
            <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur sticky top-6">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{provider.email}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {provider.phone || "Not provided"}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {provider.location || "Location not set"}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Eye className="h-4 w-4" />
                  <p className="text-sm font-semibold">Public View</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  This is exactly how seekers see your profile when searching
                  for providers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
