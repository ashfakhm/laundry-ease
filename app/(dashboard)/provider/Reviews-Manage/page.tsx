"use client";

import { useMemo } from "react";
import { Star, MessageSquare, Calendar } from "lucide-react";

type Review = {
  _id: string;
  seeker_name: string;
  rating: number;
  comment: string;
  createdAt: string;
  order_id: string;
};

// Static mock data - in production, this would come from an API
const MOCK_REVIEWS: Review[] = [
  {
    _id: "1",
    seeker_name: "Rahul Sharma",
    rating: 5,
    comment:
      "Excellent service! Very professional and clothes came back perfectly clean.",
    createdAt: "2024-12-19T10:00:00.000Z",
    order_id: "ORD123",
  },
  {
    _id: "2",
    seeker_name: "Priya Patel",
    rating: 4,
    comment: "Good quality work. Delivery was on time. Will use again.",
    createdAt: "2024-12-16T10:00:00.000Z",
    order_id: "ORD124",
  },
  {
    _id: "3",
    seeker_name: "Amit Kumar",
    rating: 5,
    comment:
      "Best laundry service in the area! Very careful with delicate fabrics.",
    createdAt: "2024-12-11T10:00:00.000Z",
    order_id: "ORD125",
  },
];

export default function ReviewsManagePage() {
  // In production, this would use SWR/React Query to fetch from API
  const reviews = MOCK_REVIEWS;

  const averageRating = useMemo(
    () => reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0,
    [reviews]
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Manage Reviews</h1>
          <p className="text-sm text-muted-foreground">
            View and respond to customer feedback
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-emerald-600">
              <Star className="h-5 w-5 fill-emerald-600" />
              <p className="text-sm font-semibold">Average Rating</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {averageRating.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">out of 5.0</p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-blue-600">
              <MessageSquare className="h-5 w-5" />
              <p className="text-sm font-semibold">Total Reviews</p>
            </div>
            <p className="mt-2 text-3xl font-bold">{reviews.length}</p>
            <p className="text-xs text-muted-foreground">all time</p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-purple-600">
              <Star className="h-5 w-5" />
              <p className="text-sm font-semibold">5-Star Reviews</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {reviews.filter((r) => r.rating === 5).length}
            </p>
            <p className="text-xs text-muted-foreground">
              {(
                (reviews.filter((r) => r.rating === 5).length /
                  reviews.length) *
                100
              ).toFixed(0)}
              % of total
            </p>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-3xl border bg-card/80 p-12 text-center shadow-sm backdrop-blur">
              <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No reviews yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Customer reviews will appear here
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <div
                key={review._id}
                className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <span className="font-semibold text-emerald-700">
                          {review.seeker_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{review.seeker_name}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < review.rating
                                    ? "fill-emerald-500 text-emerald-500"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ·
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(review.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {review.comment}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Order #{review.order_id}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
