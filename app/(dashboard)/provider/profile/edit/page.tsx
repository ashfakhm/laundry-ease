"use client";

import {
  BusinessInfoSection,
  ServicesOfferedSection,
  ServiceSettingsSection,
  FixedPriceListSection,
  BankDetailsSection,
  SecuritySection,
} from "./profile-sections";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { showToast } from "@/lib/toast";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/auth/password-policy";

const providerProfileSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    businessName: z.string().optional(),
    bio: z.string().optional(),
    description: z.string().optional(),
    location: z.string().min(3, "Location is required"),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    phone: z.string().optional(),
    services: z.array(z.string()).min(1, "Select at least one service"),
    radius_km: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(1, "Minimum radius is 1km"),
    ),
    free_radius_km: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(0),
    ),
    per_km_rate: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(0),
    ),
    pricing: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(0),
    ), // Base pricing MVP
    capacity: z.preprocess(
      (val) => (val === "" ? undefined : Number(val)),
      z.number().min(1, "Minimum capacity is 1"),
    ),
    // Fixed Price List
    items: z.array(
      z.object({
        name: z.string().min(1, "Item name is required"),
        price: z.preprocess(
          (val) => (val === "" ? undefined : Number(val)),
          z.number().min(0, "Price must be 0 or more"),
        ),
      }),
    ),
    // Bank Details
    bankAccountHolder: z.string().min(2, "Account holder name is required"),
    bankAccountNumber: z.string().min(6, "Account number is required"),
    bankIFSC: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Invalid IFSC code"),
    upiId: z.string().optional(),
    // Images
    profilePicture: z.string().optional(),
    bannerImage: z.string().optional(),
    // Security
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

export type ProviderProfileValues = {
  name: string;
  businessName?: string;
  bio?: string;
  description?: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  phone?: string;
  services: string[];
  radius_km: number;
  free_radius_km: number;
  per_km_rate: number;
  pricing: number;
  capacity: number;
  items: { name: string; price: number }[];
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIFSC?: string;
  upiId?: string;
  profilePicture?: string;
  bannerImage?: string;
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
      providerProfileSchema,
    ) as import("react-hook-form").Resolver<ProviderProfileValues>,
    defaultValues: {
      name: "",
      businessName: "",
      bio: "",
      description: "",
      location: "",
      phone: "",
      services: [],
      radius_km: 10,
      free_radius_km: 5,
      per_km_rate: 10,
      pricing: 0,
      capacity: 100,
      items: [],
      bankAccountHolder: "",
      bankAccountNumber: "",
      bankIFSC: "",
      upiId: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile/provider");
        if (!res.ok) throw new Error("Failed to load profile");
        const json = await res.json();
        const data = json.data ?? json;

        form.reset({
          name: data.name || "",
          businessName: data.businessName || "",
          bio: data.bio || "",
          description: data.description || "",
          location: data.location || "",
          coordinates: data.coordinates || undefined,
          phone: data.phone || "",
          services: data.services || [],
          radius_km: data.radius_km || 10,
          free_radius_km: data.free_radius_km || 5,
          per_km_rate: data.per_km_rate || 10,
          pricing: data.pricing || 0,
          capacity: data.capacity || 100,
          items: data.pricingRates
            ? Object.entries(data.pricingRates).map(([name, price]) => ({
                name,
                price: Number(price),
              }))
            : [],
          bankAccountHolder: data.bankDetails?.accountHolderName || "",
          bankAccountNumber: data.bankDetails?.accountNumber || "",
          bankIFSC: data.bankDetails?.ifsc || "",
          upiId: data.bankDetails?.upiId || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } catch {
        showToast.error("Could not load profile");
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
      const payload: Partial<ProviderProfileValues> & {
        pricingRates?: Record<string, number>;
      } = { ...data };

      // Transform items array back to Record<string, number>
      if (data.items) {
        payload.pricingRates = data.items.reduce(
          (acc: Record<string, number>, item) => {
            acc[item.name] = item.price;
            return acc;
          },
          {},
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

      showToast.success("Profile updated successfully");
      router.push("/provider/profile");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        showToast.error(error.message);
      } else {
        showToast.error("An unknown error occurred");
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
          <BusinessInfoSection form={form} />
          <ServicesOfferedSection form={form} />
          <ServiceSettingsSection form={form} />
          <FixedPriceListSection form={form} />
        </div>

        <BankDetailsSection form={form} />
        <SecuritySection form={form} />

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
