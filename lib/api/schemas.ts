import { z } from "zod";

/**
 * Centralized validation schemas for API requests
 * FAANG Practice: Single source of truth for all input validation
 * Updated for Zod v4 - using top-level type validators
 */

// Common validators (Zod v4 top-level APIs)
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID format");
const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number");
const emailSchema = z.email("Invalid email address");

// Booking schemas
export const createBookingSchema = z.object({
  provider_id: objectIdSchema,
  deadline: z.string().datetime().optional(),
  seeker_coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

export const scheduleBookingSchema = z.object({
  dateTime: z.string().datetime("Invalid date/time format"),
  action: z.enum(["propose", "confirm"]).optional(),
});

// Order schemas
export const createOrderItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unit_price: z.number().nonnegative("Price cannot be negative"),
  notes: z.string().optional(),
  photo_url: z.url().optional(),
});

export const createOrderSchema = z.object({
  booking_id: objectIdSchema,
  items: z.array(createOrderItemSchema).min(1, "At least one item is required"),
  seeker_location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

// Complaint schemas
export const complaintCategorySchema = z.enum([
  "late_delivery",
  "damaged_item",
  "missing_item",
  "quality_issue",
  "partial_service",
  "other",
]);

export const createComplaintSchema = z
  .object({
    order_id: objectIdSchema.optional(),
    booking_id: objectIdSchema.optional(),
    complaint_type: complaintCategorySchema,
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),
    photos: z.array(z.url()).max(5, "Maximum 5 photos allowed").optional(),
  })
  .refine((data) => data.order_id || data.booking_id, {
    message: "Either order_id or booking_id is required",
    path: ["order_id"],
  });

// Provider search schema
export const providerSearchSchema = z.object({
  location: z.string().optional(),
  name: z.string().optional(),
  service: z.string().optional(),
  deadline: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// Auth schemas
export const signupSeekerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
  phone: phoneSchema,
  address: z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    landmark: z.string().optional(),
  }),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export const signupProviderSchema = z.object({
  name: z.string().min(2),
  email: emailSchema,
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
  phone: phoneSchema,
  businessName: z.string().min(2, "Business name is required"),
  location: z.string().min(1, "Service location is required"),
  services: z.array(z.string()).min(1, "At least one service is required"),
  bio: z.string().optional(),
  description: z.string().optional(),
  radius_km: z.number().positive().max(50).default(10),
  per_km_rate: z.number().nonnegative().default(10),
  pricing: z.number().nonnegative().default(0), // "Booking Price"
  pricingRates: z.record(z.string(), z.number().nonnegative()).optional(),
  bankAccountHolder: z.string().min(2, "Account holder name required"),
  bankAccountNumber: z.string().min(6, "Account number required"),
  bankIFSC: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Invalid IFSC code"),
  upiId: z.string().optional().or(z.literal("")).optional(),
  profilePicture: z.string().optional(),
  bannerImage: z.string().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export const otpRequestSchema = z.object({
  target: z.union([emailSchema, phoneSchema]),
  type: z.enum(["email", "phone"]),
});

export const otpVerifySchema = z.object({
  target: z.string().min(1),
  type: z.enum(["email", "phone"]),
  code: z.string().length(6, "OTP must be 6 digits"),
});

// Type exports for use in components
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ProviderSearchInput = z.infer<typeof providerSearchSchema>;
export type SignupSeekerInput = z.infer<typeof signupSeekerSchema>;
export type SignupProviderInput = z.infer<typeof signupProviderSchema>;
