"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Save, X, Plus, Trash2 } from "lucide-react";

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
};

export default function EditProviderProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    bio: "",
    description: "",
    location: "",
    radius_km: "10",
    tags: "",
  });

  const [pricingRates, setPricingRates] = useState<
    { item: string; rate: string }[]
  >([]);

  useEffect(() => {
    async function fetchProviderProfile() {
      try {
        const response = await fetch("/api/profile/provider");
        if (response.ok) {
          const data: Provider = await response.json();
          setForm({
            name: data.name || "",
            businessName: data.businessName || "",
            bio: data.bio || "",
            description: data.description || "",
            location: data.location || "",
            radius_km: String(data.radius_km || 10),
            tags: data.services?.join(", ") || "",
          });

          // Convert pricingRates object to array
          if (data.pricingRates) {
            const rates = Object.entries(data.pricingRates).map(
              ([item, rate]) => ({
                item,
                rate: String(rate),
              })
            );
            setPricingRates(
              rates.length > 0 ? rates : [{ item: "", rate: "" }]
            );
          } else {
            setPricingRates([{ item: "", rate: "" }]);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchProviderProfile();
    }
  }, [session]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateRate(index: number, field: "item" | "rate", value: string) {
    setPricingRates((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  }

  function addPricingRow() {
    setPricingRates((prev) => [...prev, { item: "", rate: "" }]);
  }

  function removePricingRow(index: number) {
    if (pricingRates.length > 1) {
      setPricingRates((prev) => prev.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    // Convert pricing rates array to object
    const ratesObj = pricingRates.reduce((acc, { item, rate }) => {
      if (item && rate) {
        acc[item] = Number(rate) || 0;
      }
      return acc;
    }, {} as Record<string, number>);

    const updateData = {
      name: form.name,
      businessName: form.businessName,
      bio: form.bio,
      description: form.description,
      location: form.location,
      radius_km: Number(form.radius_km) || 10,
      services: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      pricingRates: ratesObj,
    };

    try {
      const response = await fetch("/api/profile/provider", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/provider/profile"), 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Edit Profile</h1>
            <p className="text-sm text-muted-foreground">
              Update your provider information
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
            <h2 className="text-lg font-semibold">Basic Information</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Full Name
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Business Name
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Location
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Service Radius (km)
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  type="number"
                  min="1"
                  max="100"
                  value={form.radius_km}
                  onChange={(e) => set("radius_km", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
            <h2 className="text-lg font-semibold">Profile Details</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Bio / Tagline
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  maxLength={200}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {form.bio.length}/200 characters
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <textarea
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={5}
                  required
                />
              </div>
            </div>
          </div>

          {/* Services/Tags */}
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
            <h2 className="text-lg font-semibold">Services</h2>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Service Tags (comma-separated)
              </label>
              <input
                className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="e.g., Dry Cleaning, Ironing, Laundry"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                required
              />
              {form.tags && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/30"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Pricing Rates */}
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
            <h2 className="text-lg font-semibold">Pricing Rates</h2>
            <div className="mt-4 space-y-3">
              {pricingRates.map((rate, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Item (e.g., Shirt)"
                    value={rate.item}
                    onChange={(e) => updateRate(idx, "item", e.target.value)}
                  />
                  <input
                    className="w-32 rounded-xl border bg-background px-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Rate (₹)"
                    type="number"
                    min="0"
                    value={rate.rate}
                    onChange={(e) => updateRate(idx, "rate", e.target.value)}
                  />
                  {pricingRates.length > 1 && (
                    <button
                      type="button"
                      className="rounded-xl border bg-background px-3 text-red-500 hover:bg-red-50"
                      onClick={() => removePricingRow(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                onClick={addPricingRow}
              >
                <Plus className="h-4 w-4" />
                Add Pricing Item
              </button>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Profile updated successfully! Redirecting...
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border bg-background px-6 py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
