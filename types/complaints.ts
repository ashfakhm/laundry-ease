import { ObjectId } from "mongodb";

export type Complaint = {
  _id: ObjectId;
  order_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  complaint_type: string;
  description: string;
  photos?: string[];
  status: "open" | "in_progress" | "resolved";
  createdAt: Date;
};
