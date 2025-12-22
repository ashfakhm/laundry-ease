"use client";

import React, { useState } from "react";
import Image from "next/image";

type InvoiceItem = {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string;
};

type Invoice = {
  items: InvoiceItem[];
  total?: number;
};

export default function InvoiceReviewForm({
  invoice,
  bookingId,
}: {
  invoice: Invoice;
  bookingId: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  async function handleReview(approved: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      setStatus(approved ? "approved" : "rejected");
      if (approved) setShowReviewForm(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message?: string }).message || "Unknown error");
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewLoading(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const res = await fetch(`/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, comment }),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      setReviewSuccess("Review submitted successfully!");
      setShowReviewForm(false);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setReviewError(
          (err as { message?: string }).message || "Unknown error"
        );
      } else {
        setReviewError("Unknown error");
      }
    } finally {
      setReviewLoading(false);
    }
  }

  if (status === "rejected") {
    return <div className="text-success">Invoice rejected!</div>;
  }

  if (showReviewForm) {
    return (
      <form
        onSubmit={handleSubmitReview}
        className="space-y-4 bg-card p-6 rounded-xl border"
      >
        <h2 className="font-semibold mb-2">Leave a Review</h2>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              onClick={() => setRating(star)}
              className={star <= rating ? "text-yellow-400" : "text-gray-300"}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          className="input input-bordered w-full min-h-[80px]"
          placeholder="Write your feedback..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
        />
        {reviewError && <div className="text-error">{reviewError}</div>}
        {reviewSuccess && <div className="text-success">{reviewSuccess}</div>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={reviewLoading || rating === 0}
        >
          {reviewLoading ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card p-4 rounded border">
        <h2 className="font-semibold mb-2">Invoice Items</h2>
        <ul>
          {invoice.items.map((item, i) => (
            <li key={i} className="flex gap-2 items-center">
              <span>{item.itemType}</span>
              <span>x{item.quantity}</span>
              <span>₹{item.unitPrice}</span>
              {item.photoUrl && item.photoUrl.trim() !== "" && (
                <Image
                  src={item.photoUrl}
                  alt="photo"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-cover rounded"
                />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 font-bold">
          Total: ₹
          {invoice.total !== undefined
            ? invoice.total
            : invoice.items.reduce(
                (sum, it) => sum + it.unitPrice * it.quantity,
                0
              )}
        </div>
      </div>
      {error && <div className="text-error">{error}</div>}
      <div className="flex gap-4">
        <button
          className="btn btn-success"
          disabled={loading}
          onClick={() => handleReview(true)}
        >
          Approve
        </button>
        <button
          className="btn btn-error"
          disabled={loading}
          onClick={() => handleReview(false)}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
