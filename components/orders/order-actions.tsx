"use client";

import { useState } from "react";
import { Star, AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { MAX_EVIDENCE_FILES } from "@/lib/constants";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  providerId: string;
  seekerId: string;
}

export function ReviewModal({
  isOpen,
  onClose,
  orderId,
  providerId,
  seekerId,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          provider_id: providerId,
          seeker_id: seekerId,
          rating,
          comment,
        }),
      });

      if (res.ok) {
        toast.success("Review submitted successfully");
        onClose();
        router.refresh();
      } else {
        toast.error("Failed to submit review");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold font-heading">Rate Experience</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
              Details
            </label>
            <textarea
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="How was the service? (Optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}

interface ComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

const COMPLAINT_TYPES = [
  { label: "Late Delivery", value: "late_delivery" },
  { label: "Damaged Item", value: "damaged_item" },
  { label: "Missing Item", value: "missing_item" },
  { label: "Quality Issue", value: "quality_issue" },
  { label: "Partial Service", value: "partial_service" },
  { label: "Other", value: "other" },
];

import { EvidenceUpload } from "@/components/ui/evidence-upload";

// ... inside ComplaintModal
export function ComplaintModal({
  isOpen,
  onClose,
  orderId,
}: ComplaintModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(COMPLAINT_TYPES[0].value);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }
    if (title.length < 5) {
      toast.error("Title must be at least 5 characters");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          title,
          complaint_type: type,
          description,
          photos,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Complaint raised successfully");
        onClose();
        // Redirect to new Dispute Chat
        router.push(`/seeker/disputes/${data.data?._id || data._id}`);
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to raise complaint");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold font-heading flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" /> Raise Complaint
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-amber-500/10 text-amber-600 text-xs font-medium rounded-xl mb-4">
          Important: Raising a complaint will verify the issue before releasing
          payment to the provider.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
              Issue Title
            </label>
            <input
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/20 transition-all"
              placeholder="Brief summary of issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={5}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
              Issue Type
            </label>
            <select
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/20 transition-all"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {COMPLAINT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
              Description
            </label>
            <textarea
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-destructive/20 transition-all"
              placeholder="Please describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              {description.length}/10 min chars
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
              Evidence (Optional)
            </label>
            <EvidenceUpload
              value={photos}
              onChange={setPhotos}
              maxFiles={MAX_EVIDENCE_FILES}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || description.length < 10 || title.length < 5}
            className="w-full py-3 bg-destructive text-destructive-foreground font-bold rounded-xl shadow-lg shadow-destructive/20 hover:bg-destructive/90 transition-all disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Complaint"}
          </button>
        </form>
      </div>
    </div>
  );
}
