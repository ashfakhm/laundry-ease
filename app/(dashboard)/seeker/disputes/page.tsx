"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, MessageSquare, Clock, CheckCircle } from "lucide-react";
import { Complaint } from "@/types/complaints";
import { cn } from "@/lib/utils";

export default function SeekerDisputesPage() {
  const [disputes, setDisputes] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDisputes() {
      try {
        const res = await fetch("/api/complaints");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setDisputes(data);
          }
        }
      } catch (error) {
        console.error("Error fetching disputes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDisputes();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Active Disputes</h1>
          <p className="text-muted-foreground mt-1">Manage and track your open support cases.</p>
        </div>
      </div>

      {disputes.length === 0 ? (
        <div className="rounded-3xl border border-border/50 bg-card/40 p-12 text-center backdrop-blur-xl">
           <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
             <CheckCircle className="h-8 w-8 text-muted-foreground" />
           </div>
           <h3 className="mt-4 text-xl font-bold">No Active Disputes</h3>
           <p className="mt-2 text-muted-foreground">Everything looks good! You have no open issues.</p>
           <Link href="/seeker/bookings" className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
             View Bookings
           </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((dispute) => (
            <Link 
              key={dispute._id.toString()} 
              href={`/seeker/disputes/${dispute._id}`}
              className="group relative flex items-center gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl hover:bg-card/60 transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            >
               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                 <AlertCircle className="h-6 w-6" />
               </div>
               
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                     <span className="font-mono text-xs text-muted-foreground">#{dispute._id.toString().slice(-6)}</span>
                     <StatusBadge status={dispute.status} />
                  </div>
                  <h3 className="font-semibold truncate">{dispute.title || "Untitled Dispute"}</h3>
                  <p className="text-sm text-muted-foreground truncate">{dispute.description}</p>
               </div>

               <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="text-xs hidden sm:inline-block">
                     {new Date(dispute.createdAt).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
               </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    open: "bg-blue-500/10 text-blue-500",
    verified: "bg-purple-500/10 text-purple-500",
    in_review: "bg-amber-500/10 text-amber-500",
    resolved: "bg-emerald-500/10 text-emerald-500",
    rejected: "bg-gray-500/10 text-gray-500",
  };
  
  const labels = {
    open: "Opened",
    verified: "Verified",
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
