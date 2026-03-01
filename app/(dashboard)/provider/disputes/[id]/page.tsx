"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Complaint } from "@/types/complaints";
import ComplaintChat from "@/components/complaint-chat";
import { cn } from "@/lib/utils";
import { unwrapApiData } from "@/lib/client-api";

export default function ProviderDisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/complaints/${id}`);
        if (!res.ok) {
           if (res.status === 403) throw new Error("Access Denied");
           throw new Error("Failed to load dispute");
        }
        const payload = await res.json();
        const data = unwrapApiData<Complaint>(payload);
        setComplaint(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load dispute";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-destructive font-bold">{error}</div>;
  if (!complaint) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
       {/* Header */}
       <div className="flex items-center gap-4">
          <Link href="/provider/disputes" className="p-2 hover:bg-muted rounded-full transition-colors">
             <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
             <div className="flex items-center gap-3">
                <h1 className="text-xl font-heading font-bold">{complaint.title || "Dispute Case"}</h1>
                <StatusBadge status={complaint.status} />
             </div>
             <p className="text-sm text-muted-foreground">Order ID: {complaint.order_id.toString()}</p>
          </div>
       </div>

       {/* Chat Area */}
       <div className="flex-1 min-h-0 bg-background/40 backdrop-blur-sm border border-border/50 rounded-3xl shadow-xl overflow-hidden">
          <ComplaintChat complaintId={id} selfRole="provider" />
       </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    open: "bg-blue-500/10 text-blue-500",
    accepted: "bg-purple-500/10 text-purple-500",
    in_review: "bg-amber-500/10 text-amber-500",
    resolved: "bg-emerald-500/10 text-emerald-500",
    rejected: "bg-gray-500/10 text-gray-500",
  };
  
  const labels = {
    open: "Opened",
    accepted: "Accepted",
    in_review: "In Review",
    resolved: "Resolved",
    rejected: "Rejected"
  };

  const key = status as keyof typeof styles;

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", styles[key] || styles.open)}>
      {labels[key] || status}
    </span>
  );
}
