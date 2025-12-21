import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { Role } from "@/types/enums";
import { Booking } from "@/types/bookings";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== Role.SEEKER) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { db } = await getDb();
    
    // Aggregation to join provider details
    const bookings = await db
      .collection<Booking>("bookings")
      .aggregate([
        { $match: { seeker_id: new ObjectId(session.user.id) } },
        {
             $lookup: {
                 from: "users",
                 localField: "provider_id",
                 foreignField: "_id",
                 as: "provider"
             }
        },
        { $unwind: "$provider" },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();
      
    // Fix: ObjectId matching might be tricky if not cast.
    // Let's rely on standard find with proper casting if direct aggregate fails, 
    // but aggregate is better for joins.
    // Ideally we import ObjectId.
    
    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching seeker bookings:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
