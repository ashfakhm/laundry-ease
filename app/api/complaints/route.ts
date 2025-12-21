import { createComplaint, getOrderById, freezeEscrow } from "@/lib/db";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { createComplaintSchema } from "@/lib/api/schemas";
import { Errors } from "@/lib/api/errors";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSeeker();

  const body = await req.json();
  const result = createComplaintSchema.safeParse(body);

  if (!result.success) {
    throw Errors.validation(
      "Invalid complaint data",
      result.error.flatten().fieldErrors
    );
  }

  const { order_id, complaint_type, description, photos } = result.data;

  const order = await getOrderById(new ObjectId(order_id));

  if (!order) {
    throw Errors.notFound("Order not found");
  }

  if (order.seeker_id.toString() !== session.user.id) {
    throw Errors.forbidden(
      "You are not authorized to raise a complaint for this order"
    );
  }

  const complaint = await createComplaint({
    order_id: new ObjectId(order_id),
    seeker_id: new ObjectId(session.user.id),
    provider_id: order.provider_id,
    complaint_type,
    description,
    photos,
  });

  // Freeze escrow when complaint is raised
  await freezeEscrow(new ObjectId(order_id));

  return successResponse(complaint, 201);
});
