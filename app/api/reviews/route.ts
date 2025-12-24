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
        
        // Check duplicate
        const existing = await db.collection("reviews").findOne({ order_id: new ObjectId(order_id) });
        if (existing) {
            return NextResponse.json({ error: "You have already reviewed this order" }, { status: 400 });
        }
        
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
// GET /api/reviews?provider_id=...
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const provider_id = searchParams.get("provider_id");

        if (!provider_id) {
            return NextResponse.json({ error: "Provider ID required" }, { status: 400 });
        }

        const { db } = await getDb();
        const reviews = await db.collection("reviews").aggregate([
            { $match: { provider_id: new ObjectId(provider_id) } },
            { $lookup: { from: "seekers", localField: "seeker_id", foreignField: "_id", as: "seeker" } },
            { $unwind: { path: "$seeker", preserveNullAndEmptyArrays: true } },
            // Lookup Order
            { $lookup: { from: "orders", localField: "order_id", foreignField: "_id", as: "order" } },
            { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
            
            { $project: { rating: 1, comment: 1, createdAt: 1, order_id: 1, booking_id: "$order.booking_id", "seeker.name": 1 } },
            { $sort: { createdAt: -1 } }
        ]).toArray();

        return NextResponse.json(reviews);
    } catch (error: any) {
        console.error("Fetch Reviews Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
