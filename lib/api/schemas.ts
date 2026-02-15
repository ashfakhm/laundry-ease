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
  deadline: z.string().datetime("Deadline must be a valid ISO datetime"),
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
      "Password must contain at least one special character",
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
      lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
      lng: z
        .number()
        .min(-180)
        .max(180, "Longitude must be between -180 and 180"),
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
      lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
      lng: z
        .number()
        .min(-180)
        .max(180, "Longitude must be between -180 and 180"),
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

// Profile update schemas
export const updateSeekerProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
  address: z
    .object({
      line1: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      country: z.string().min(1),
      postalCode: z.string().min(1),
      landmark: z.string().optional(),
    })
    .optional(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    )
    .optional(),
});

export const updateProviderProfileSchema = z.object({
  name: z.string().min(2).optional(),
  businessName: z.string().min(2).optional(),
  bio: z.string().optional(),
  description: z.string().optional(),
  location: z.string().min(1).optional(),
  services: z.array(z.string()).optional(),
  pricingRates: z.record(z.string(), z.number().nonnegative()).optional(),
  radius_km: z.number().positive().max(50).optional(),
  free_radius_km: z.number().nonnegative().optional(),
  per_km_rate: z.number().nonnegative().optional(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  pricing: z.number().nonnegative().optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    )
    .optional(),
  capacity: z.number().int().positive().max(100).optional(),
  phone: phoneSchema.optional(),
  profilePicture: z.string().url().optional(),
  bannerImage: z.string().url().optional(),
  bankAccountHolder: z.string().min(2).optional(),
  bankAccountNumber: z.string().min(6).optional(),
  bankIFSC: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Invalid IFSC code")
    .optional(),
  upiId: z.string().optional(),
});

// Review schemas
export const createReviewSchema = z.object({
  order_id: objectIdSchema,
  provider_id: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Booking action schemas
export const bookingScheduleSchema = z.object({
  dateTime: z.string().datetime("Invalid date/time format"),
  action: z.enum(["propose", "confirm"]).optional(),
});

export const bookingArrivedSchema = z.object({
  bookingId: objectIdSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const bookingPaymentInitSchema = z.object({
  bookingId: objectIdSchema,
});

export const invoiceReviewSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export const invoiceCreateSchema = z.object({
  items: z
    .array(
      z.object({
        itemType: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        photoUrl: z.string().url().optional(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
});

export const paymentVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    "processing",
    "washing",
    "ironing",
    "ready",
    "out_for_delivery",
  ]),
  // Note: "invoiced" is the initial state when order is created, not a transition target
  // Note: "delivered" can only be set via confirm-delivery endpoint (requires OTP)
});

export const orderScheduleDeliverySchema = z.object({
  action: z.enum(["propose", "confirm"]),
  dateTime: z.string().datetime().optional(),
});

export const confirmDeliverySchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// Admin schemas
export const adminComplaintStatusSchema = z.object({
  status: z.enum(["open", "accepted", "in_review", "resolved", "rejected"]),
});

export const adminComplaintAcceptSchema = z.object({
  deadlineDays: z.number().min(1).max(14).default(7), // Days until provider must respond
});

export const adminComplaintResolveSchema = z.object({
  outcome: z.enum(["refund_full", "refund_partial", "release_payout", "reject"]),
  seeker_refund_amount: z.number().nonnegative().optional(),
}).superRefine((data, ctx) => {
  if (
    data.outcome === "refund_partial" &&
    typeof data.seeker_refund_amount !== "number"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["seeker_refund_amount"],
      message: "seeker_refund_amount is required for refund_partial outcome",
    });
  }
});

export const adminComplaintAccessSchema = z.object({
  granted: z.boolean(),
});

export const adminSystemAlertAcknowledgeSchema = z.object({
  note: z.string().min(3).max(500).optional(),
  owner: z
    .enum(["platform_admin_oncall", "backend_oncall", "tech_lead"])
    .optional(),
});

export const adminRefundSchema = z
  .object({
    paymentId: z.string().min(1),
    bookingId: objectIdSchema.optional(),
    orderId: objectIdSchema.optional(),
    amount: z.number().positive().optional(),
    reason: z.string().min(5).optional(),
  })
  .superRefine((data, ctx) => {
    const hasBooking = Boolean(data.bookingId);
    const hasOrder = Boolean(data.orderId);
    if (hasBooking === hasOrder) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookingId"],
        message: "Provide exactly one of bookingId or orderId",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orderId"],
        message: "Provide exactly one of bookingId or orderId",
      });
    }
  });

// Auth schemas
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const sendMagicLinkSchema = z.object({
  email: emailSchema,
});

// Complaint message schema
export const complaintMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export const bookingChatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export const bookingDisputeSchema = z.object({
  reason: z.string().min(3).max(120),
  details: z.string().min(10).max(5000),
});

// Type exports for use in components
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ProviderSearchInput = z.infer<typeof providerSearchSchema>;
export type SignupSeekerInput = z.infer<typeof signupSeekerSchema>;
export type SignupProviderInput = z.infer<typeof signupProviderSchema>;
export type UpdateSeekerProfileInput = z.infer<
  typeof updateSeekerProfileSchema
>;
export type UpdateProviderProfileInput = z.infer<
  typeof updateProviderProfileSchema
>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
