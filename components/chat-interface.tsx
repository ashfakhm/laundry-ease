"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { EvidenceUpload } from "@/components/ui/evidence-upload";

interface DisputeState {
  open: boolean;
  title: string;
  reason: string;
  details: string;
  photos: string[];
  loading: boolean;
  error: string | null;
  success: string | null;
}

interface ChatMessage {
  _id?: string;
  sender_id: string;
  sender_role: "seeker" | "provider";
  message: string;
  createdAt: string;
}

const COMPLAINT_TYPES = [
  { value: "late_delivery", label: "Late Delivery" },
  { value: "damaged_item", label: "Damaged Item" },
  { value: "missing_item", label: "Missing Item" },
  { value: "quality_issue", label: "Quality Issue" },
  { value: "partial_service", label: "Partial Service" },
  { value: "other", label: "Other" },
];

export default function BookingChat({
  bookingId,
  selfRole,
}: {
  bookingId: string;
  selfRole: "seeker" | "provider";
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const latestMessageAtRef = useRef<string | null>(null);

  const [dispute, setDispute] = useState<DisputeState>({
    open: false,
    title: "",
    reason: "late_delivery",
    details: "",
    photos: [],
    loading: false,
    error: null,
    success: null,
  });

  const fetchMessages = useCallback(
    async (incremental = false) => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/chat`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();

        if (data.length > 0) {
          const latestCreatedAt = data[data.length - 1].createdAt;
          if (latestMessageAtRef.current !== latestCreatedAt) {
            latestMessageAtRef.current = latestCreatedAt;
            setShouldAutoScroll(true);
          }
        } else if (!incremental) {
          setShouldAutoScroll(true);
        }

        setMessages(data);
      } catch {
        setError("Could not load chat");
      }
    },
    [bookingId],
  );

  useEffect(() => {
    fetchMessages(false);
    const interval = setInterval(() => fetchMessages(true), 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setInput("");
      setShouldAutoScroll(true);
      fetchMessages(true);
    } catch {
      setError("Could not send message");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisputeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDispute((d) => ({ ...d, loading: true, error: null, success: null }));
    try {
      // Use new API: POST /api/complaints
      const res = await fetch(`/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId, // Pass bookingId, API resolves order
          title: dispute.title,
          complaint_type: dispute.reason,
          description: dispute.details,
          photos: dispute.photos,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to raise dispute");
      }

      const data = await res.json();

      setDispute((d) => ({
        ...d,
        loading: false,
        success: "Dispute raised! Redirecting...",
      }));

      setTimeout(() => {
        router.push(`/seeker/disputes/${data.data?._id || data._id}`);
      }, 1000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not raise dispute";
      setDispute((d) => ({
        ...d,
        loading: false,
        error: message,
      }));
    }
  }

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShouldAutoScroll(false);
    }
  }, [messages, shouldAutoScroll]);

  return (
    <div className="flex flex-col h-full bg-background/50 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
            <div className="p-3 bg-muted rounded-full">
              <Send className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium">Start the conversation</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg._id || i}
            className={`flex ${
              msg.sender_role === selfRole ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm shadow-sm transition-all ${
                msg.sender_role === selfRole
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-background border border-border rounded-bl-sm"
              }`}
            >
              <p>{msg.message}</p>
              <div
                className={`text-[10px] mt-1 text-right opacity-60 leading-none`}
              >
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={sendMessage}
        className="flex gap-2 p-3 border-t bg-card/80 backdrop-blur-sm"
      >
        <button
          type="button"
          className="p-2.5 text-amber-500 hover:bg-amber-500/10 rounded-full transition-colors"
          title="Raise Dispute"
          onClick={() => setDispute((d) => ({ ...d, open: true }))}
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
        <input
          className="flex-1 bg-muted/50 border border-transparent focus:border-primary/20 focus:bg-background rounded-full px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/70"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button
          className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
          type="submit"
          disabled={loading || !input.trim()}
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>

      {error && (
        <div className="text-destructive text-xs p-2 text-center bg-destructive/5 font-medium">
          {error}
        </div>
      )}

      {/* Dispute Modal */}
      {dispute.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 border border-border my-auto">
            <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Report an
              Issue
            </h2>
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                  Issue Title
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={dispute.title}
                  onChange={(e) =>
                    setDispute((d) => ({ ...d, title: e.target.value }))
                  }
                  required
                  placeholder="Summarize the problem"
                  minLength={5}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                  Category
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={dispute.reason}
                  onChange={(e) =>
                    setDispute((d) => ({ ...d, reason: e.target.value }))
                  }
                  required
                >
                  {COMPLAINT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-25 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={dispute.details}
                  onChange={(e) =>
                    setDispute((d) => ({ ...d, details: e.target.value }))
                  }
                  required
                  placeholder="Describe the issue in detail..."
                  minLength={10}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
                  Evidence (Optional)
                </label>
                <EvidenceUpload
                  value={dispute.photos}
                  onChange={(urls) =>
                    setDispute((d) => ({ ...d, photos: urls }))
                  }
                />
              </div>

              {(dispute.error || dispute.success) && (
                <div
                  className={`p-3 rounded-xl text-sm font-medium ${dispute.error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"}`}
                >
                  {dispute.error || dispute.success}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                  onClick={() =>
                    setDispute((d) => ({
                      ...d,
                      open: false,
                      error: null,
                      success: null,
                    }))
                  }
                  disabled={dispute.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-amber-500/20"
                  disabled={dispute.loading}
                >
                  {dispute.loading ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
