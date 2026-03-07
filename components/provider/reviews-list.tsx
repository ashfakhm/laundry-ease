"use client";
import { useEffect, useState } from "react";
import { Star, User } from "lucide-react";
import { reportError } from "@/lib/client-error";

type ReviewItem = {
  seeker?: { name?: string };
  rating: number;
  createdAt: string;
  comment: string;
};

export function ReviewsList({ providerId }: { providerId: string }) {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!providerId) return;
        fetch(`/api/providers/${providerId}/reviews`)
            .then(res => res.json())
            .then(json => {
                if (json.success && Array.isArray(json.data)) {
                    setReviews(json.data as ReviewItem[]);
                } else if (Array.isArray(json)) {
                    setReviews(json as ReviewItem[]);
                }
            })
            .catch(err => reportError("ReviewFetchError", err))
            .finally(() => setLoading(false));
    }, [providerId]);

    if (loading) return <div className="text-sm text-muted-foreground animate-pulse">Loading reviews...</div>;
    if (reviews.length === 0) return <div className="text-sm text-muted-foreground italic">No reviews yet.</div>;

    return (
        <div className="space-y-6">
             {reviews.map((r, i) => (
                 <div key={i} className="border-b border-border last:border-0 pb-6 last:pb-0">
                     <div className="flex items-start justify-between mb-2">
                         <div className="flex items-center gap-3">
                             <div className="h-10 w-10 bg-linear-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center shadow-sm">
                                 <User className="w-5 h-5 text-primary" />
                             </div>
                             <div>
                                 <p className="font-bold text-sm">{r.seeker?.name || "LaundryEase User"}</p>
                                 <div className="flex items-center gap-1 mt-0.5">
                                     <div className="flex text-amber-400">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-current" : "text-muted"}`} />
                                        ))}
                                     </div>
                                     <span className="text-xs font-medium text-foreground">{r.rating}.0</span>
                                 </div>
                             </div>
                         </div>
                         <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2 py-1 rounded-full">{new Date(r.createdAt).toLocaleDateString()}</span>
                     </div>
                     <p className="text-sm text-muted-foreground leading-relaxed pl-[3.25rem]">{r.comment}</p>
                 </div>
             ))}
        </div>
    );
}
