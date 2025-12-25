"use client";
import React, { useEffect, useRef, useState } from "react";
import { Send, Image as ImageIcon, Lock } from "lucide-react";
import Image from "next/image";

interface ChatMessage {
  _id: string;
  sender_id: string;
  sender_role: "seeker" | "provider" | "admin" | "system";
  message_type: "TEXT" | "IMAGE" | "SYSTEM";
  content: string;
  attachments?: string[];
  createdAt: string;
}

export default function ComplaintChat({
  complaintId,
  selfRole,
}: {
  complaintId: string;
  selfRole: "seeker" | "provider" | "admin";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Polling
    return () => clearInterval(interval);
  }, [complaintId]);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`);
      if (res.status === 403) {
        const data = await res.json();
        if (data.error?.includes("resolved")) {
          setIsResolved(true);
          setError("Dispute is resolved. Chat is archived.");
        } else {
          setError("Access Denied");
        }
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
      // Don't overwrite specific error if set
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !isResolved) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, attachments: [] }), // Attachments UI TBD
      });

      if (res.status === 403 || res.status === 400) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }

      if (!res.ok) throw new Error("Failed to send message");

      setInput("");
      fetchMessages();
    } catch (err: any) {
      setError(err.message || "Could not send message");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-background/50 relative rounded-2xl overflow-hidden border border-border/50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-h-[400px]">
        {messages.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
            <p className="text-sm font-medium">No messages yet.</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-center text-sm font-semibold flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> {error}
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
                  : msg.sender_role === "system"
                  ? "bg-muted text-muted-foreground w-full text-center mx-auto text-xs py-1"
                  : "bg-background border border-border rounded-bl-sm"
              }`}
            >
              {msg.sender_role === "system" ? (
                <span className="italic">{msg.content}</span>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {msg.attachments.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/20"
                        >
                          <Image
                            src={url}
                            alt="Complaint evidence image"
                            width={128}
                            height={128}
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {msg.sender_role !== "system" && (
                <div
                  className={`text-[10px] mt-1 text-right opacity-60 leading-none`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isResolved && !error && (
        <form
          onSubmit={sendMessage}
          className="flex gap-2 p-3 border-t bg-card/80 backdrop-blur-sm"
        >
          {/* Attachment Button Placeholder */}
          {/* 
            <button type="button" className="p-2.5 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                <ImageIcon className="w-5 h-5" />
            </button> 
            */}

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
      )}
    </div>
  );
}
