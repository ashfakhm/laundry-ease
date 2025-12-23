import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Review, Provider } from "@/lib/db";

// POST /api/reviews
export async function POST(req: NextRequest) {
    try {
        const { order_id, seeker_id, provider_id, rating, comment } = await req.json();

        if (!order_id || !seeker_id || !provider_id || !rating) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const { db } = await getDb();
        
        // Create Review
        const review: Review = {
            order_id: new ObjectId(order_id),
            seeker_id: new ObjectId(seeker_id),
            provider_id: new ObjectId(provider_id),
            rating: Number(rating),
            comment,
            createdAt: new Date()
        };

        await db.collection<Review>("reviews").insertOne(review);

        // Update Provider Average Rating
        const reviews = await db.collection<Review>("reviews").find({ provider_id: new ObjectId(provider_id) }).toArray();
        const totalRating = reviews.reduce((acc, curr) => acc + curr.rating, 0);
        const avgRating = totalRating / reviews.length;

        await db.collection<Provider>("providers").updateOne(
            { _id: new ObjectId(provider_id) },
            { $set: { rating: avgRating, reviewCount: reviews.length } }
        );

        return NextResponse.json({ success: true, message: "Review submitted" });

    } catch (error: any) {
        console.error("Review Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
