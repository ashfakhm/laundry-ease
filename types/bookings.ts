import { ObjectId } from "mongodb";
import { Role } from "./enums";

export type Booking = {
  _id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  status: "requested" | "accepted" | "rejected";
  createdAt: Date;
};
