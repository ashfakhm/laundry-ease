"use client";

import { UseFormReturn, useFieldArray, type FieldErrors } from "react-hook-form";
import { type ProviderProfileValues } from "./page";
import { motion } from "framer-motion";
import {
  Briefcase,
  MapPin,
  Sparkles,
  Truck,
  DollarSign,
  Tag,
  Plus,
  Trash2,
  Lock,
  Check,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";

const LAUNDRY_SERVICES = [
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

type FormProps = { form: UseFormReturn<ProviderProfileValues> };

export function BusinessInfoSection({ form }: FormProps) {
  return (
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
          <h2 className="text-xl font-bold font-heading">Business Info</h2>
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
                typeof form.formState.errors.name?.message === "string" && (
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
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-muted-foreground">
                Mobile Number
              </label>
              <input
                {...form.register("phone")}
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="e.g. +91 9876543210"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <LocationAutocomplete
                value={form.watch("location")}
                onChange={(address, coords) => {
                  form.setValue("location", address, { shouldValidate: true });
                  if (coords)
                    form.setValue("coordinates", coords, {
                      shouldValidate: true,
                    });
                }}
                placeholder="City, Area"
              />
            </div>
            {form.formState.errors.location &&
              typeof form.formState.errors.location?.message === "string" && (
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
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Profile Images
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <ImageUpload
                label="Profile Picture"
                value={
                  (form.watch("profilePicture") as unknown as string) || ""
                }
                onChange={(val) => form.setValue("profilePicture", val)}
                variant="profile"
              />
              <div className="md:col-span-2">
                <ImageUpload
                  label="Banner Image"
                  value={(form.watch("bannerImage") as unknown as string) || ""}
                  onChange={(val) => form.setValue("bannerImage", val)}
                  variant="banner"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These images will be displayed on your public profile.
            </p>
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

export function ServicesOfferedSection({ form }: FormProps) {
  const selectedServices = form.watch("services");
  const toggleService = (service: string) => {
    const current = form.getValues("services") || [];
    if (current.includes(service)) {
      form.setValue(
        "services",
        current.filter((s: string) => s !== service),
        { shouldValidate: true, shouldDirty: true },
      );
    } else {
      form.setValue("services", [...current, service], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.5 }}
    >
      <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold font-heading">Services Offered</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Select the services you provide to customers.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LAUNDRY_SERVICES.map((service) => {
            const isSelected = selectedServices?.includes(service);
            return (
              <div
                key={service}
                onClick={() => toggleService(service)}
                className={cn(
                  "cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-muted/20 border-border hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {service}
                </span>
                {isSelected && (
                  <div className="h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {form.formState.errors.services && (
          <p className="text-xs text-destructive mt-2">
            {form.formState.errors.services.message as string}
          </p>
        )}
      </SpotlightCard>
    </motion.div>
  );
}

export function ServiceSettingsSection({ form }: FormProps) {
  return (
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
          <h2 className="text-xl font-bold font-heading">Service Settings</h2>
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
                {...form.register("free_radius_km", { valueAsNumber: true })}
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Max Concurrent Bookings (Capacity)
            </label>
            <input
              type="number"
              {...form.register("capacity", { valueAsNumber: true })}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              min={1}
            />
            {form.formState.errors.capacity &&
              typeof form.formState.errors.capacity?.message === "string" && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.capacity.message}
                </p>
              )}
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
              <DollarSign className="h-4 w-4 text-emerald-500" /> Booking
              Pricing
            </h4>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Booking Price (₹)
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
  );
}

export function FixedPriceListSection({ form }: FormProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
    >
      <SpotlightCard className="h-full rounded-3xl bg-card border-border p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
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
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
        <div className="space-y-4">
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
              No items added yet. Add items to automate invoicing.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
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
                    {(form.formState.errors.items as FieldErrors<ProviderProfileValues>["items"])?.[index]?.name && (
                      <p className="text-xs text-destructive">
                        {
                          (form.formState.errors.items as FieldErrors<ProviderProfileValues>["items"])?.[index]?.name
                            ?.message
                        }
                      </p>
                    )}
                    {(form.formState.errors.items as FieldErrors<ProviderProfileValues>["items"])?.[index]?.price && (
                      <p className="text-xs text-destructive">
                        {
                          (form.formState.errors.items as FieldErrors<ProviderProfileValues>["items"])?.[index]?.price
                            ?.message
                        }
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
  );
}

export function BankDetailsSection({ form }: FormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.5 }}
    >
      <SpotlightCard className="rounded-3xl bg-card border-border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <DollarSign className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold font-heading">
            Payout (Bank) Details
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Account Holder Name
            </label>
            <input
              {...form.register("bankAccountHolder")}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="As per bank records"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Account Number
            </label>
            <input
              {...form.register("bankAccountNumber")}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Bank account number"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              IFSC Code
            </label>
            <input
              {...form.register("bankIFSC")}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
                form.setValue("bankIFSC", e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              UPI ID (Optional)
            </label>
            <input
              {...form.register("upiId")}
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="yourname@upi"
            />
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

export function SecuritySection({ form }: FormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <SpotlightCard className="rounded-3xl bg-card border-border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-500">
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
  );
}
