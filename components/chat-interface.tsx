"use client";
import React, { useEffect, useRef, useState } from "react";
import { Send, AlertTriangle } from "lucide-react";

interface DisputeState {
  open: boolean;
  reason: string;
  details: string;
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

export default function BookingChat({
  bookingId,
  selfRole,
}: {
  bookingId: string;
  selfRole: "seeker" | "provider";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [dispute, setDispute] = useState<DisputeState>({
    open: false,
    reason: "",
    details: "",
    loading: false,
    error: null,
    success: null,
  });

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      setError("Could not load chat");
    }
  }

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
      fetchMessages();
    } catch (err) {
      setError("Could not send message");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisputeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDispute((d) => ({ ...d, loading: true, error: null, success: null }));
    try {
      const res = await fetch(`/api/bookings/${bookingId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: dispute.reason,
          details: dispute.details,
        }),
      });
      if (!res.ok) throw new Error("Failed to raise dispute");
      setDispute((d) => ({
        ...d,
        loading: false,
        success: "Dispute raised successfully!",
        reason: "",
        details: "",
      }));
      setTimeout(
        () => setDispute((d) => ({ ...d, open: false, success: null })),
        1200
      );
    } catch (err) {
      setDispute((d) => ({
        ...d,
        loading: false,
        error: "Could not raise dispute",
      }));
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-card relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={msg._id || i}
            className={`flex ${
              msg.sender_role === selfRole ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2 max-w-[80%] text-sm shadow-sm ${
                msg.sender_role === selfRole
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-muted text-foreground rounded-tl-none"
              }`}
            >
              {msg.message}
              <div className={`text-[10px] mt-1 text-right opacity-70`}>
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
      <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t bg-card/50 backdrop-blur-sm">
        <button
          type="button"
          className="btn btn-square btn-ghost btn-sm text-warning"
          title="Raise Dispute"
          onClick={() => setDispute((d) => ({ ...d, open: true }))}
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
        <input
          className="input input-bordered input-sm flex-1 rounded-full"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button
          className="btn btn-circle btn-primary btn-sm"
          type="submit"
          disabled={loading || !input.trim()}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      
      {error && <div className="text-error text-xs p-2 text-center">{error}</div>}

      {/* Dispute Modal */}
      {dispute.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
                 <AlertTriangle className="w-6 h-6 text-warning" /> Rate Dispute
            </h2>
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={dispute.reason}
                  onChange={(e) =>
                    setDispute((d) => ({ ...d, reason: e.target.value }))
                  }
                  required
                  placeholder="e.g., Damaged item, Late delivery"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Details
                </label>
                <textarea
                  className="textarea textarea-bordered w-full min-h-[100px]"
                  value={dispute.details}
                  onChange={(e) =>
                    setDispute((d) => ({ ...d, details: e.target.value }))
                  }
                  required
                  placeholder="Describe the issue..."
                />
              </div>
              
              {(dispute.error || dispute.success) && (
                 <div className={`p-3 rounded-xl text-sm ${dispute.error ? "bg-error/10 text-error" : "bg-success/10 text-success"}`}>
                     {dispute.error || dispute.success}
                 </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  className="btn btn-ghost"
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
                  className="btn btn-warning"
                  disabled={dispute.loading}
                >
                  {dispute.loading ? <span className="loading loading-spinner loading-sm"></span> : "Submit Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
