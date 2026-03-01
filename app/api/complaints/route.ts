import { COMPLAINT_FILING_WINDOW_MS } from "@/lib/constants";
import { createComplaint, getOrderById, freezeEscrow } from "@/lib/db/index";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireAuth, requireSeeker } from "@/lib/api/auth";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { createComplaintSchema } from "@/lib/api/schemas";
import { Errors } from "@/lib/api/errors";
import { ComplaintMessage } from "@/types/complaints";
import { Role } from "@/types/enums";

export const POST = withErrorHandling(async (req: Request) => {
  const { user } = await requireSeeker();
  if (!ObjectId.isValid(user.id)) {
    throw Errors.unauthorized();
  }
  const seekerId = new ObjectId(user.id);

  const body = await req.json();
  const result = createComplaintSchema.safeParse(body);

  if (!result.success) {
    throw Errors.validation(
      "Invalid complaint data",
      result.error.flatten().fieldErrors,
    );
  }

  const { order_id, booking_id, complaint_type, title, description, photos } =
    result.data;

  const { db } = await getDb();
  let orderIdObj: ObjectId;

  if (order_id) {
    if (!ObjectId.isValid(order_id)) {
      throw Errors.validation("Invalid order id");
    }
    orderIdObj = new ObjectId(order_id);
  } else if (booking_id) {
    if (!ObjectId.isValid(booking_id)) {
      throw Errors.validation("Invalid booking id");
    }
    // Resolve order from booking
    const foundOrder = await db
      .collection("orders")
      .findOne({ booking_id: new ObjectId(booking_id) });
    if (!foundOrder) {
      throw Errors.notFound("No active order found for this booking.");
    }
    orderIdObj = foundOrder._id;
  } else {
    throw Errors.validation("Order ID or Booking ID required");
  }

  // 1. One Order = One Complaint Rule

  // Check for any existing complaint for this order (resolved or active)
  // Requirement: "one order can only have one complaint"
  const existingComplaint = await db.collection("complaints").findOne({
    order_id: orderIdObj,
  });

  if (existingComplaint) {
    // If user wants to re-open, logic might be different, but strict requirement implies block.
    throw Errors.conflict("A complaint already exists for this order.");
  }

  const order = await getOrderById(orderIdObj);

  if (!order) {
    throw Errors.notFound("Order not found");
  }

  if (order.seeker_id.toString() !== seekerId.toString()) {
    throw Errors.forbidden(
      "You are not authorized to raise a complaint for this order",
    );
  }

  if (order.process_status !== "delivered") {
    throw Errors.validation(
      "Complaints can only be raised after delivery is confirmed",
    );
  }

  const deliveredAtRaw = order.otp_confirmed_at || order.escrow_started_at;
  if (!deliveredAtRaw) {
    throw Errors.validation("Delivery timestamp missing for this order");
  }

  const deliveredAt = new Date(deliveredAtRaw);
  if (Number.isNaN(deliveredAt.getTime())) {
    throw Errors.validation("Invalid delivery timestamp");
  }

  let complaintDeadline = new Date(
    deliveredAt.getTime() + COMPLAINT_FILING_WINDOW_MS,
  );

  // Allow explicit admin extension of the SLA window
  if (order.extended_complaint_window_until) {
    const extendedDeadline = new Date(order.extended_complaint_window_until);
    if (
      !Number.isNaN(extendedDeadline.getTime()) &&
      extendedDeadline.getTime() > complaintDeadline.getTime()
    ) {
      complaintDeadline = extendedDeadline;
    }
  }

  if (Date.now() > complaintDeadline.getTime()) {
    throw Errors.conflict(
      "Complaint window expired. Complaints must be raised within 24 hours of delivery, or by the granted extension deadline.",
    );
  }

  // 2. Create Complaint
  const complaint = await createComplaint({
    order_id: orderIdObj,
    booking_id: order.booking_id, // Order has booking_id
    seeker_id: seekerId,
    provider_id: order.provider_id,
    complaint_type,
    title,
    description,
    photos,
  });

  // 3. Create Initial Message (The description + photos)
  // "complaints chat first conversation aka chat will be the photos and his title and description"
  const now = new Date();

  const initialContent = `**${title}**\n\n${description}`;

  const initialMessage: Omit<ComplaintMessage, "_id"> = {
    complaint_id: complaint._id as ObjectId,
    sender_id: seekerId,
    sender_role: "seeker",
    message_type: "TEXT",
    content: initialContent,
    attachments: photos || [],
    createdAt: now,
  };

  await db.collection("complaint_messages").insertOne(initialMessage);

  // 4. Freeze escrow when complaint is raised
  await freezeEscrow(orderIdObj);

  return successResponse(complaint, 201);
});

export const GET = withErrorHandling(async (_req: Request) => {
  const { user } = await requireAuth();
  if (!ObjectId.isValid(user.id) || !user.role) {
    throw Errors.unauthorized();
  }

  const { db } = await getDb();
  const userId = new ObjectId(user.id);

  const activeStatuses = ["open", "accepted", "in_review"] as const;

  if (user.role === Role.SEEKER) {
    const seekerComplaints = await db
      .collection("complaints")
      .find({
        seeker_id: userId,
        status: { $in: activeStatuses },
      })
      .toArray();
    return successResponse(seekerComplaints);
  }

  if (user.role === Role.PROVIDER) {
    const providerComplaints = await db
      .collection("complaints")
      .find({
        provider_id: userId,
        status: { $in: activeStatuses },
        provider_access_granted: true,
      })
      .toArray();
    return successResponse(providerComplaints);
  }

  return successResponse([]);
});
