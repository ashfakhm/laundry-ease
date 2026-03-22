"use client";

import {
  Controller,
  UseFormReturn,
  useFieldArray,
  type FieldPath,
} from "react-hook-form";
import { type ProviderProfileValues } from "./page";
import { motion } from "framer-motion";
import { useState, type HTMLInputTypeAttribute, type InputHTMLAttributes } from "react";
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
  Eye,
  EyeOff,
  Loader2,
  Save,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import { LAUNDRY_SERVICES } from "@/lib/constants";

type FormProps = { 
  form: UseFormReturn<ProviderProfileValues>;
  isSaving?: boolean;
};

type ControlledFieldProps<TName extends FieldPath<ProviderProfileValues>> = {
  form: UseFormReturn<ProviderProfileValues>;
  name: TName;
  className: string;
  placeholder?: string;
};

type ControlledTextInputProps<TName extends FieldPath<ProviderProfileValues>> =
  ControlledFieldProps<TName> & {
    type?: HTMLInputTypeAttribute;
    autoComplete?: string;
    inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
    maxLength?: number;
    transformValue?: (value: string) => string;
  };

function ControlledTextInput<TName extends FieldPath<ProviderProfileValues>>({
  form,
  name,
  className,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  transformValue,
}: ControlledTextInputProps<TName>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <input
          ref={field.ref}
          name={field.name}
          type={type}
          value={typeof field.value === "string" ? field.value : ""}
          onBlur={field.onBlur}
          onChange={(event) => {
            const nextValue = transformValue
              ? transformValue(event.target.value)
              : event.target.value;
            field.onChange(nextValue);
          }}
          className={className}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
        />
      )}
    />
  );
}

type ControlledNumberInputProps<TName extends FieldPath<ProviderProfileValues>> =
  ControlledFieldProps<TName> & {
    min?: number;
    max?: number;
    step?: number;
  };

function ControlledNumberInput<TName extends FieldPath<ProviderProfileValues>>({
  form,
  name,
  className,
  placeholder,
  min,
  max,
  step,
}: ControlledNumberInputProps<TName>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <input
          ref={field.ref}
          name={field.name}
          type="number"
          value={typeof field.value === "number" ? field.value : ""}
          onBlur={field.onBlur}
          onChange={(event) => {
            const { value } = event.target;
            field.onChange(value === "" ? undefined : Number(value));
          }}
          className={className}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
        />
      )}
    />
  );
}

function ControlledTextarea<TName extends FieldPath<ProviderProfileValues>>({
  form,
  name,
  className,
  placeholder,
}: ControlledFieldProps<TName>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <textarea
          ref={field.ref}
          name={field.name}
          value={typeof field.value === "string" ? field.value : ""}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.target.value)}
          className={className}
          placeholder={placeholder}
        />
      )}
    />
  );
}

function SectionSaveButton({ isSaving }: { isSaving?: boolean }) {
  return (
    <div className="mt-8 flex justify-end">
      <button
        type="submit"
        disabled={isSaving}
        className="h-10 px-6 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save Changes
      </button>
    </div>
  );
}

export function BusinessInfoSection({ form, isSaving }: FormProps) {
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
              <ControlledTextInput
                form={form}
                name="name"
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                autoComplete="name"
              />
              {typeof form.formState.errors.name?.message === "string" && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Business Name
              </label>
              <ControlledTextInput
                form={form}
                name="businessName"
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="e.g. Sparkle Laundry"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-muted-foreground">
                Mobile Number
              </label>
              <ControlledTextInput
                form={form}
                name="phone"
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="e.g. +91 9876543210"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Controller
                control={form.control}
                name="location"
                render={({ field }) => (
                  <LocationAutocomplete
                    value={field.value ?? ""}
                    onChange={(address, coords) => {
                      field.onChange(address);
                      form.setValue("coordinates", coords, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    placeholder="City, Area"
                  />
                )}
              />
            </div>
            {typeof form.formState.errors.location?.message === "string" && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.location.message}
                </p>
              )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Short Bio
            </label>
            <ControlledTextInput
              form={form}
              name="bio"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Expert laundry services..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Detailed Description
            </label>
            <ControlledTextarea
              form={form}
              name="description"
              className="w-full min-h-25 rounded-lg border border-input bg-background p-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Describe your services, equipment, and expertise..."
            />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Profile Images
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <Controller
                control={form.control}
                name="profilePicture"
                render={({ field }) => (
                  <ImageUpload
                    label="Profile Picture"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={(val) => field.onChange(val)}
                    variant="profile"
                  />
                )}
              />
              <div className="md:col-span-2">
                <Controller
                  control={form.control}
                  name="bannerImage"
                  render={({ field }) => (
                    <ImageUpload
                      label="Banner Image"
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(val) => field.onChange(val)}
                      variant="banner"
                    />
                  )}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These images will be displayed on your public profile.
            </p>
          </div>
        </div>
        <SectionSaveButton isSaving={isSaving} />
      </SpotlightCard>
    </motion.div>
  );
}

export function ServicesOfferedSection({ form, isSaving }: FormProps) {
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
        <Controller
          control={form.control}
          name="services"
          render={({ field, fieldState }) => {
            const selectedServices = field.value ?? [];

            const toggleService = (service: string) => {
              const nextServices = selectedServices.includes(service)
                ? selectedServices.filter((selected) => selected !== service)
                : [...selectedServices, service];

              field.onChange(nextServices);
            };

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LAUNDRY_SERVICES.map((service) => {
                    const isSelected = selectedServices.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={cn(
                          "cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                          isSelected
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-muted/20 border-border hover:border-primary/50",
                        )}
                        aria-pressed={isSelected}
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
                      </button>
                    );
                  })}
                </div>
                {fieldState.error?.message && (
                  <p className="text-xs text-destructive mt-2">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            );
          }}
        />
        <SectionSaveButton isSaving={isSaving} />
      </SpotlightCard>
    </motion.div>
  );
}

export function ServiceSettingsSection({ form, isSaving }: FormProps) {
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
              <ControlledNumberInput
                form={form}
                name="radius_km"
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                min={1}
              />
              {typeof form.formState.errors.radius_km?.message === "string" && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.radius_km.message}
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Free Radius (km)
              </label>
              <ControlledNumberInput
                form={form}
                name="free_radius_km"
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                min={0}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Max Concurrent Bookings (Capacity)
            </label>
            <ControlledNumberInput
              form={form}
              name="capacity"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              min={1}
            />
            {typeof form.formState.errors.capacity?.message === "string" && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.capacity.message}
                </p>
              )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Extra Delivery Charge (₹ per km)
            </label>
            <ControlledNumberInput
              form={form}
              name="per_km_rate"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              min={0}
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
              <ControlledNumberInput
                form={form}
                name="pricing"
                className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                min={0}
              />
            </div>
          </div>
        </div>
        <SectionSaveButton isSaving={isSaving} />
      </SpotlightCard>
    </motion.div>
  );
}

export function FixedPriceListSection({ form, isSaving }: FormProps) {
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
                    <Controller
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field, fieldState }) => (
                        <>
                          <input
                            ref={field.ref}
                            name={field.name}
                            value={field.value ?? ""}
                            onBlur={field.onBlur}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                            placeholder="Item Name (e.g. Shirt)"
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                          {fieldState.error?.message && (
                            <p className="text-xs text-destructive">
                              {fieldState.error.message}
                            </p>
                          )}
                        </>
                      )}
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        ₹
                      </span>
                      <Controller
                        control={form.control}
                        name={`items.${index}.price`}
                        render={({ field, fieldState }) => (
                          <>
                            <input
                              ref={field.ref}
                              name={field.name}
                              type="number"
                              value={
                                typeof field.value === "number"
                                  ? field.value
                                  : ""
                              }
                              onBlur={field.onBlur}
                              onChange={(event) => {
                                const { value } = event.target;
                                field.onChange(
                                  value === "" ? undefined : Number(value),
                                );
                              }}
                              placeholder="Price"
                              className="w-full h-9 pl-6 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            {fieldState.error?.message && (
                              <p className="text-xs text-destructive mt-2">
                                {fieldState.error.message}
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>
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
        <SectionSaveButton isSaving={isSaving} />
      </SpotlightCard>
    </motion.div>
  );
}

export function BankDetailsSection({ form, isSaving }: FormProps) {
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
            <ControlledTextInput
              form={form}
              name="bankAccountHolder"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="As per bank records"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Account Number
            </label>
            <ControlledTextInput
              form={form}
              name="bankAccountNumber"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Bank account number"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              IFSC Code
            </label>
            <ControlledTextInput
              form={form}
              name="bankIFSC"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              autoComplete="off"
              transformValue={(value) => value.toUpperCase()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              UPI ID (Optional)
            </label>
            <ControlledTextInput
              form={form}
              name="upiId"
              className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="yourname@upi"
              autoComplete="off"
            />
          </div>
        </div>
        <SectionSaveButton isSaving={isSaving} />
      </SpotlightCard>
    </motion.div>
  );
}

export function SecuritySection({ form, isSaving }: FormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
            <div className="relative">
              <ControlledTextInput
                form={form}
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                className="w-full h-11 rounded-lg border border-input bg-background px-4 pr-10 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle current password visibility"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
            <div className="relative">
              <ControlledTextInput
                form={form}
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                className="w-full h-11 rounded-lg border border-input bg-background px-4 pr-10 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Min 8 chars"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle new password visibility"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
            <div className="relative">
              <ControlledTextInput
                form={form}
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="w-full h-11 rounded-lg border border-input bg-background px-4 pr-10 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
        <SectionSaveButton isSaving={isSaving} />
      </SpotlightCard>
    </motion.div>
  );
}
