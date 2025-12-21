import { createBooking } from "@/lib/db";
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

  const booking = await createBooking({
    seeker_id,
    provider_id: new ObjectId(provider_id),
    deadline: deadline ? new Date(deadline) : undefined,
    seeker_coordinates,
  });

  return successResponse(booking, 201);
});
