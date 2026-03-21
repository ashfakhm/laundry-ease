"use client";

import { useState } from "react";
import { ReviewModal, ComplaintModal } from "./order-actions";
import { Star, AlertTriangle } from "lucide-react";

interface PostDeliveryActionsProps {
  orderId: string;
  providerId: string;
  seekerId: string;
  deliveredAt?: string | Date;
  isDelivered: boolean;
  hasReviewed?: boolean;
}

export function PostDeliveryActions({
  orderId,
  providerId,
  seekerId,
  deliveredAt,
  isDelivered,
  hasReviewed,
}: PostDeliveryActionsProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  if (!isDelivered) return null;

  // Check 24h complaint window (only if delivered)
  const deliveredDate = deliveredAt ? new Date(deliveredAt) : new Date();
  const diffMs = new Date().getTime() - deliveredDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const canComplain = diffHours <= 24;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {/* Review Button */}
        {!hasReviewed ? (
          <button
            onClick={() => setReviewOpen(true)}
            className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 font-bold"
          >
            <Star className="w-5 h-5 fill-primary/20" />
            Write a Review
          </button>
        ) : (
           <div className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-muted text-muted-foreground border border-border font-bold cursor-default opacity-70">
              <Star className="w-5 h-4" />
              Review Submitted
           </div>
        )}

        {/* Complaint Button - Valid for 24h post-delivery */}
        {canComplain && (
          <button
            onClick={() => setComplaintOpen(true)}
            className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all border border-destructive/20 font-bold"
          >
            <AlertTriangle className="w-5 h-5" />
            Raise Complaint ({Math.max(0, 24 - Math.floor(diffHours))}h left)
          </button>
        )}
      </div>


      <ReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        orderId={orderId}
        providerId={providerId}
        seekerId={seekerId}
      />

      <ComplaintModal
        isOpen={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        orderId={orderId}
      />
    </>
  );
}
