import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";

const requestRescheduleSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});

// POST /api/bookings/:id/reschedule/request
// Either seeker or provider can request a reschedule while pickup is still in negotiation/execution.
export const POST = withErrorHandling(
  async (req: Request, context?: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "bookings:reschedule:request",
      max: 20,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!ObjectId.isValid(user.id)) {
      throw Errors.unauthorized();
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestRescheduleSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.validation(
        "Invalid request",
        parsed.error.flatten().fieldErrors,
      );
    }

    if (!context?.params) {
      throw Errors.validation("Booking id is required");
    }
    const { id } = await context.params;
    if (typeof id !== "string" || id.length === 0) {
      throw Errors.validation("Booking id is required");
    }
    if (!ObjectId.isValid(id)) {
      throw Errors.validation("Invalid booking id");
    }

    const { db } = await getDb();

    const bookingQuery = { _id: new ObjectId(id) };

    const booking = await db.collection("bookings").findOne(bookingQuery);
    if (!booking) {
      throw Errors.notFound("Booking");
    }

    // Ownership check: seeker OR provider
    const isOwnerSeeker = booking.seeker_id?.toString?.() === user.id;
    const isOwnerProvider = booking.provider_id?.toString?.() === user.id;

    if (!isOwnerSeeker && !isOwnerProvider) {
      throw Errors.forbidden("You are not allowed to reschedule this booking");
    }

    // State gating
    const allowedStatuses = ["accepted", "pickup_proposed", "confirmed"];
    if (!allowedStatuses.includes(booking.status)) {
      throw Errors.invalidState(
        `Reschedule is not allowed when booking status is '${booking.status}'.`,
      );
    }

    if (booking.arrivedAt) {
      throw Errors.invalidState(
        "Reschedule is not allowed after provider has arrived",
      );
    }

    if (booking.status === "invoice_created" || booking.status === "completed") {
      throw Errors.invalidState(
        "Reschedule is not allowed after invoice creation",
      );
    }

    const requestedBy = isOwnerProvider ? "provider" : "seeker";
    const now = new Date();

    const currentCount =
      typeof booking.reschedule?.count === "number"
        ? booking.reschedule.count
        : 0;

    const previousPickupSlot = booking.pickupSlot?.dateTime
      ? {
          dateTime: booking.pickupSlot.dateTime,
          confirmedAt: booking.pickupSlot.confirmedAt,
        }
      : undefined;

    const result = await db.collection("bookings").updateOne(
      {
        ...bookingQuery,
        status: { $in: allowedStatuses },
        arrivedAt: { $exists: false },
      },
      {
        $set: {
          status: "reschedule_requested",
          "pickupSlot.confirmedAt": undefined,
          reschedule: {
            requestedBy,
            requestedAt: now,
            reason: parsed.data.reason,
            count: currentCount + 1,
            ...(previousPickupSlot ? { previousPickupSlot } : {}),
          },
          updatedAt: now,
        },
      },
    );

    if (result.matchedCount === 0) {
      throw Errors.invalidState("Booking was not in a reschedulable state");
    }

    return successResponse({ success: true });
  },
);
