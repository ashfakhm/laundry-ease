"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [dispute, setDispute] = useState<DisputeState>({
    open: false,
    reason: "",
    details: "",
    loading: false,
    error: null,
    success: null,
  });

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
    } catch {
      setDispute((d) => ({
        ...d,
        loading: false,
        error: "Could not raise dispute",
      }));
    }
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data);
    } catch {
      setError("Could not load chat");
    }
  }, [bookingId]);

  useEffect(() => {
    fetchMessages();
    // Optionally, poll for new messages every 5s
    const interval = setInterval(fetchMessages, 5000);
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
      fetchMessages();
    } catch {
      setError("Could not send message");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-96 border rounded-xl bg-card relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={msg._id || i}
            className={`flex ${
              msg.sender_role === selfRole ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 max-w-xs text-sm shadow-sm ${
                msg.sender_role === selfRole
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.message}
              <div className="text-[10px] text-muted-foreground mt-1 text-right">
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
      <form onSubmit={sendMessage} className="flex gap-2 p-2 border-t">
        <input
          className="input input-bordered flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
        <button
          type="button"
          className="btn btn-warning"
          onClick={() => setDispute((d) => ({ ...d, open: true }))}
        >
          Raise Dispute
        </button>
      </form>
      {error && <div className="text-error p-2">{error}</div>}

      {/* Dispute Modal */}
      {dispute.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-2">Raise Dispute</h2>
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Details
                </label>
                <textarea
                  className="input input-bordered w-full min-h-[80px]"
                  value={dispute.details}
                  onChange={(e) =>
                    setDispute((d) => ({ ...d, details: e.target.value }))
                  }
                  required
                />
              </div>
              {dispute.error && (
                <div className="text-error">{dispute.error}</div>
              )}
              {dispute.success && (
                <div className="text-success">{dispute.success}</div>
              )}
              <div className="flex gap-2 justify-end">
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
                  className="btn btn-primary"
                  disabled={dispute.loading}
                >
                  {dispute.loading ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
