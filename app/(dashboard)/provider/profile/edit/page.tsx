"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Briefcase,
  MapPin,
  Lock,
  Save,
  Sparkles,
  DollarSign,
  Truck,
  Plus,
  Trash2,
  Tag,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useRouter } from "next/navigation";

const providerProfileSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    businessName: z.string().optional(),
    bio: z.string().optional(),
    description: z.string().optional(),
    location: z.string().min(3, "Location is required"),
    phone: z.string().optional(),
    radius_km: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(1, "Minimum radius is 1km")
    ),
    free_radius_km: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(0)
    ),
    per_km_rate: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(0)
    ),
    pricing: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(0)
    ), // Base pricing MVP
    // Fixed Price List
    items: z.array(
      z.object({
        name: z.string().min(1, "Item name is required"),
        price: z.preprocess(
          (val) => (val === "" ? undefined : Number(val)),
          z.number().min(0, "Price must be 0 or more")
        ),
      })
    ),
    // Security
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length < 8) {
        return false;
      }
      return true;
    },
    {
      message: "New password must be at least 8 characters",
      path: ["newPassword"],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Current password is required to change password",
      path: ["currentPassword"],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );

type ProviderProfileValues = {
  name: string;
  businessName?: string;
  bio?: string;
  description?: string;
  location: string;
  phone?: string;
  radius_km: number;
  free_radius_km: number;
  per_km_rate: number;
  pricing: number;
  items: { name: string; price: number }[];
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ProviderEditProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProviderProfileValues>({
    resolver: zodResolver(
      providerProfileSchema
    ) as import("react-hook-form").Resolver<ProviderProfileValues>,
    defaultValues: {
      name: "",
      businessName: "",
      bio: "",
      description: "",
      location: "",
      phone: "",
      radius_km: 10,
      free_radius_km: 5,
      per_km_rate: 10,
      pricing: 0,
      items: [],
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile/provider");
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();

        form.reset({
          name: data.name || "",
          businessName: data.businessName || "",
          bio: data.bio || "",
          description: data.description || "",
          location: data.location || "",
          phone: data.phone || "",
          radius_km: data.radius_km || 10,
          free_radius_km: data.free_radius_km || 5,
          per_km_rate: data.per_km_rate || 10,
          pricing: data.pricing || 0,
          items: data.pricingRates
            ? Object.entries(data.pricingRates).map(([name, price]) => ({
                name,
                price: Number(price),
              }))
            : [],
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } catch {
        toast.error("Could not load profile");
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [form]);

  async function onSubmit(data: ProviderProfileValues) {
    setIsSaving(true);
    try {
      // Clean up empty password fields
      const payload: any = { ...data };
      
      // Transform items array back to Record<string, number>
      if (data.items) {
        payload.pricingRates = data.items.reduce(
          (acc: Record<string, number>, item) => {
            acc[item.name] = item.price;
            return acc;
          },
          {}
        );
        delete payload.items;
      }

      if (!data.newPassword) {
        delete payload.currentPassword;
        delete payload.newPassword;
        delete payload.confirmPassword;
      }

      const res = await fetch("/api/profile/provider", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }

      toast.success("Profile updated successfully");
      router.push("/provider/profile");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unknown error occurred");
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 space-y-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          Edit Business Profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          Update your service details, pricing, and security settings.
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Business Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold font-heading">
                  Business Info
                </h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Your Name
                    </label>
                    <input
                      {...form.register("name")}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    {form.formState.errors.name &&
                      typeof form.formState.errors.name?.message ===
                        "string" && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Business Name
                    </label>
                    <input
                      {...form.register("businessName")}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="e.g. Sparkle Laundry"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <input
                      {...form.register("location")}
                      className="w-full h-11 pl-10 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="City, Area"
                    />
                  </div>
                  {form.formState.errors.location &&
                    typeof form.formState.errors.location?.message ===
                      "string" && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.location.message}
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Short Bio
                  </label>
                  <input
                    {...form.register("bio")}
                    className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Expert laundry services..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Detailed Description
                  </label>
                  <textarea
                    {...form.register("description")}
                    className="w-full min-h-25 rounded-lg border border-input bg-background p-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Describe your services, equipment, and expertise..."
                  />
                </div>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* Service & Delivery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Truck className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold font-heading">
                  Service Settings
                </h2>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Max Radius (km)
                    </label>
                    <input
                      type="number"
                      {...form.register("radius_km", { valueAsNumber: true })}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    {form.formState.errors.radius_km &&
                      typeof form.formState.errors.radius_km?.message ===
                        "string" && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.radius_km.message}
                        </p>
                      )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Free Radius (km)
                    </label>
                    <input
                      type="number"
                      {...form.register("free_radius_km", {
                        valueAsNumber: true,
                      })}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Extra Delivery Charge (₹ per km)
                  </label>
                  <input
                    type="number"
                    {...form.register("per_km_rate", { valueAsNumber: true })}
                    className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" /> Base
                    Pricing
                  </h4>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Starting From (₹)
                    </label>
                    <input
                      type="number"
                      {...form.register("pricing", { valueAsNumber: true })}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* Fixed Price List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="md:col-span-2"
          >
            <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-heading">
                      Fixed Price List
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Define standard prices for common items.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => append({ name: "", price: 0 })}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {fields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                    No items added yet. Add items to automate invoicing.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border group hover:border-primary/50 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <input
                            {...form.register(`items.${index}.name`)}
                            placeholder="Item Name (e.g. Shirt)"
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                              ₹
                            </span>
                            <input
                              type="number"
                              {...form.register(`items.${index}.price`, {
                                valueAsNumber: true,
                              })}
                              placeholder="Price"
                              className="w-full h-9 pl-6 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          {form.formState.errors.items?.[index]?.name && (
                            <p className="text-xs text-destructive">
                              {form.formState.errors.items[index]?.name?.message}
                            </p>
                          )}
                           {form.formState.errors.items?.[index]?.price && (
                            <p className="text-xs text-destructive">
                              {form.formState.errors.items[index]?.price?.message}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SpotlightCard>
          </motion.div>
        </div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <SpotlightCard className="rounded-3xl bg-card border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold font-heading">Security</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Current Password
                </label>
                <input
                  type="password"
                  {...form.register("currentPassword")}
                  className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Enter current password"
                />
                {form.formState.errors.currentPassword &&
                  typeof form.formState.errors.currentPassword?.message ===
                    "string" && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.currentPassword.message}
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  New Password
                </label>
                <input
                  type="password"
                  {...form.register("newPassword")}
                  className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Min 8 chars"
                />
                {form.formState.errors.newPassword &&
                  typeof form.formState.errors.newPassword?.message ===
                    "string" && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.newPassword.message}
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  {...form.register("confirmPassword")}
                  className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Confirm new password"
                />
                {form.formState.errors.confirmPassword &&
                  typeof form.formState.errors.confirmPassword?.message ===
                    "string" && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Leave fields blank if you do not wish to change your password.
            </p>
          </SpotlightCard>
        </motion.div>

        <div className="flex justify-end gap-4 pt-4 pb-20">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-12 px-8 text-foreground/70 font-semibold hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-12 px-8 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(45,212,191,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </main>
  );
}
