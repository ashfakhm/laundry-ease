import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";

/**
 * GET /api/admin/complaints
 * Fetch all complaints with seeker and provider details
 */
export async function GET() {
  try {
    await requireAdminWithDbCheck();

    const { db } = await getDb();

    // Fetch complaints and enrich seeker/provider in a single query plan
    const complaints = await db
      .collection("complaints")
      .aggregate([
        { $sort: { createdAt: -1 } },
        {
          $addFields: {
            seekerObjectId: {
              $convert: {
                input: "$seeker_id",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
            providerObjectId: {
              $convert: {
                input: "$provider_id",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "seekers",
            localField: "seekerObjectId",
            foreignField: "_id",
            as: "seeker",
            pipeline: [{ $project: { name: 1, email: 1 } }],
          },
        },
        {
          $lookup: {
            from: "providers",
            localField: "providerObjectId",
            foreignField: "_id",
            as: "provider",
            pipeline: [{ $project: { name: 1, businessName: 1, profilePicture: 1 } }],
          },
        },
        {
          $set: {
            seeker: { $ifNull: [{ $arrayElemAt: ["$seeker", 0] }, null] },
            provider: { $ifNull: [{ $arrayElemAt: ["$provider", 0] }, null] },
          },
        },
        {
          $unset: ["seekerObjectId", "providerObjectId"],
        },
      ])
      .toArray();

    const normalizedComplaints = complaints.map((complaint) => ({
      ...complaint,
      _id: complaint._id.toString(),
      seeker_id: complaint.seeker_id?.toString() || null,
      provider_id: complaint.provider_id?.toString() || null,
      order_id: complaint.order_id?.toString() || null,
    }));

    return NextResponse.json(normalizedComplaints, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("ADMIN_COMPLAINTS", "Error fetching complaints", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
