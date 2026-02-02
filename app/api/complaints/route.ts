import { createComplaint, getOrderById, freezeEscrow } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireSeeker } from "@/lib/api/auth";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { createComplaintSchema } from "@/lib/api/schemas";
import { Errors } from "@/lib/api/errors";
import { ComplaintMessage } from "@/types/complaints";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSeeker();

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
    orderIdObj = new ObjectId(order_id);
  } else if (booking_id) {
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

  if (order.seeker_id.toString() !== session.user.id) {
    throw Errors.forbidden(
      "You are not authorized to raise a complaint for this order",
    );
  }

  // 2. Create Complaint
  const complaint = await createComplaint({
    order_id: orderIdObj,
    booking_id: order.booking_id, // Order has booking_id
    seeker_id: new ObjectId(session.user.id),
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
    sender_id: new ObjectId(session.user.id),
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

export const GET = withErrorHandling(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw Errors.unauthorized();
  }

  const { db } = await getDb();
  const userId = new ObjectId(session.user.id);

  // Determine Role (Optimization: Session usually has role, but we check specific collections if needed)
  // We'll query generic based on ID match.

  const activeStatuses = ["open", "accepted", "in_review"];

  // 1. Seeker Logic
  const seekerComplaints = await db
    .collection("complaints")
    .find({
      seeker_id: userId,
      status: { $in: activeStatuses },
    })
    .toArray();

  if (seekerComplaints.length > 0) {
    return successResponse(seekerComplaints); // Seeker found
  }

  // 2. Provider Logic (Only check if no seeker complaints found, or just query both?)
  // A user could potentially be both? Unlikely in this app context.
  // Provider can ONLY see if access granted.
  const providerComplaints = await db
    .collection("complaints")
    .find({
      provider_id: userId,
      status: { $in: activeStatuses },
      provider_access_granted: true,
    })
    .toArray();

  // 3. Admin logic? Admin uses /api/admin/complaints.

  const allFound = [...seekerComplaints, ...providerComplaints];
  // Deduplicate by ID just in case
  const unique = Array.from(
    new Map(allFound.map((item) => [item._id.toString(), item])).values(),
  );

  return successResponse(unique);
});
