import { ObjectId } from "mongodb";

export type Review = {
  _id?: ObjectId;
  order_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  seeker_name?: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
};
