import { createBooking } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { createBookingSchema } from "@/lib/api/schemas";
import { Errors } from "@/lib/api/errors";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSeeker();

  const body = await req.json();
  const result = createBookingSchema.safeParse(body);

  if (!result.success) {
    throw Errors.validation(
      "Invalid booking data",
      result.error.flatten().fieldErrors
    );
  }

  const { provider_id, deadline, seeker_coordinates } = result.data;
  const seeker_id = new ObjectId(session.user.id);
  const providerOid = new ObjectId(provider_id);

  const { db } = await getDb();
  const provider = await db
    .collection("providers")
    .findOne({ _id: providerOid });

  if (!provider) {
    throw Errors.notFound("Provider not found");
  }

  // **Capacity Check (Race Condition Mitigation)**
  const activeBookings = await db.collection("bookings").countDocuments({
    provider_id: providerOid,
    status: {
      $in: ["requested", "accepted", "pickup_proposed", "confirmed"],
    },
  });

  const activeOrders = await db.collection("orders").countDocuments({
    provider_id: providerOid,
    process_status: {
      $in: [
        "invoiced",
        "processing",
        "washing",
        "ironing",
        "ready",
        "out_for_delivery",
      ],
    },
  });

  const capacity = provider.capacity || 5;
  if (activeBookings + activeOrders >= capacity) {
    throw Errors.conflict(
      `Provider is currently at full capacity (${
        activeBookings + activeOrders
      }/${capacity}). Please try again later or choose another provider.`
    );
  }

  const booking = await createBooking({
    seeker_id,
    provider_id: providerOid,
    deadline: deadline ? new Date(deadline) : undefined,
    seeker_coordinates,
    bookingFee: provider.pricing || 0,
  });

  return successResponse(booking, 201);
});
