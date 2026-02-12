import { Complaint } from "@/types/complaints";
import { getDb } from "../mongodb";
import { ObjectId } from "mongodb";

/**
 * Create a new complaint
 */
export async function createComplaint(data: {
  order_id: ObjectId;
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  complaint_type: string;
  title: string;
  description: string;
  photos?: string[];
}) {
  const { db } = await getDb();
  const now = new Date();

  const complaint: Omit<Complaint, "_id"> = {
    order_id: data.order_id,
    booking_id: data.booking_id,
    seeker_id: data.seeker_id,
    provider_id: data.provider_id,
    complaint_type: data.complaint_type,
    title: data.title,
    description: data.description,
    photos: data.photos,
    status: "open",
    participants: [data.seeker_id], // Initially just seeker (and implicit admin)
    provider_access_granted: false,
    createdAt: now,
  };

  const res = await db
    .collection<Omit<Complaint, "_id">>("complaints")
    .insertOne(complaint);
  return { ...complaint, _id: res.insertedId };
}
