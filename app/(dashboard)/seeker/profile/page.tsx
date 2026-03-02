"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/toast";
import { Loader2, User, MapPin, Lock, Save, Sparkles } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { unwrapApiData } from "@/lib/client-api";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";

const profileSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().min(10, "Phone must be valid"),
    address: z.object({
      line1: z.string().min(3, "Address is required"),
      city: z.string().min(2, "City is required"),
      state: z.string().min(2, "State is required"),
      country: z.string().min(2, "Country is required"),
      postalCode: z.string().min(5, "Postal code is required"),
      landmark: z.string().optional(),
    }),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !isStrongPassword(data.newPassword)) {
        return false;
      }
      return true;
    },
    {
      message: PASSWORD_POLICY_MESSAGE,
      path: ["newPassword"],
    },
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
    },
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
    },
  );

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SeekerProfilePage() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: {
        line1: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        landmark: "",
      },
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile/seeker", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load profile");
        const payload = await res.json();
        const data = unwrapApiData<{
          name?: string;
          phone?: string;
          address?: {
            line1?: string;
            city?: string;
            state?: string;
            country?: string;
            postalCode?: string;
            landmark?: string;
          };
        }>(payload);

        form.reset({
          name: data.name || "",
          phone: data.phone || "",
          address: {
            line1: data.address?.line1 || "",
            city: data.address?.city || "",
            state: data.address?.state || "",
            country: data.address?.country || "India",
            postalCode: data.address?.postalCode || "",
            landmark: data.address?.landmark || "",
          },
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
  }, [form, toast]);

  async function onSubmit(data: ProfileFormValues) {
    setIsSaving(true);
    try {
      // Clean up empty password fields before sending
      const payload: ProfileFormValues = { ...data };
      if (!data.newPassword) {
        delete payload.currentPassword;
        delete payload.newPassword;
        delete payload.confirmPassword;
      }

      const res = await fetch("/api/profile/seeker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          (typeof err?.error === "string" && err.error) ||
            err?.error?.message ||
            err?.message ||
            "Failed to update",
        );
      }

      toast.success("Profile updated successfully");
      // Reset password fields
      form.setValue("currentPassword", "");
      form.setValue("newPassword", "");
      form.setValue("confirmPassword", "");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
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
          My Profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your personal information, address, and security.
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Personal Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold font-heading">
                  Personal Details
                </h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </label>
                  <input
                    {...form.register("name")}
                    className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="John Doe"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Phone Number
                  </label>
                  <input
                    {...form.register("phone")}
                    className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="+91 98765 43210"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>
              </div>
            </SpotlightCard>
          </motion.div>

          {/* Address Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <MapPin className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold font-heading">
                  Delivery Address
                </h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Address Line 1
                  </label>
                  <LocationAutocomplete
                    value={form.watch("address.line1")}
                    onChange={(val) =>
                      form.setValue("address.line1", val, {
                        shouldValidate: true,
                      })
                    }
                    placeholder="Wing A, Flat 402, Tech Park"
                  />
                  {form.formState.errors.address?.line1 && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.address.line1.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      City
                    </label>
                    <input
                      {...form.register("address.city")}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="Mumbai"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Postal Code
                    </label>
                    <input
                      {...form.register("address.postalCode")}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="400001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      State
                    </label>
                    <input
                      {...form.register("address.state")}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="Maharashtra"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Country
                    </label>
                    <input
                      {...form.register("address.country")}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="India"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Landmark (Optional)
                  </label>
                  <input
                    {...form.register("address.landmark")}
                    className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Near Central Mall"
                  />
                </div>
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
                {form.formState.errors.currentPassword && (
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
                {form.formState.errors.newPassword && (
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
                {form.formState.errors.confirmPassword && (
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

        <div className="flex justify-end pt-4 pb-20">
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
