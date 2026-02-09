"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Lock } from "lucide-react";
import Image from "next/image";

interface ChatMessage {
  _id: string;
  sender_id: string;
  sender_role: string;
  message_type: string;
  content: string;
  attachments?: string[];
  createdAt: string;
}

type ComplaintParticipants = {
  seekerName: string;
  providerName: string;
};

type SenderRole = "seeker" | "provider" | "admin" | "system";

function getProviderParticipantName(
  provider?: {
    name?: string | null;
    businessName?: string | null;
  } | null,
): string {
  const name = provider?.name?.trim();
  const businessName = provider?.businessName?.trim();

  if (name && !["provider", "laundry"].includes(name.toLowerCase())) {
    return name;
  }

  return businessName || name || "Provider";
}

function normalizeSenderRole(senderRole: unknown): SenderRole {
  if (typeof senderRole !== "string") return "system";
  const normalized = senderRole.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "provider") return "provider";
  if (normalized === "seeker") return "seeker";
  return "system";
}

function getSenderLabel(
  senderRole: SenderRole,
  participants: ComplaintParticipants,
): string {
  if (senderRole === "admin") return "Admin";
  if (senderRole === "seeker") return `${participants.seekerName} (Seeker)`;
  if (senderRole === "provider")
    return `${participants.providerName} (Provider)`;
  return "System";
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
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [participants, setParticipants] = useState<ComplaintParticipants>({
    seekerName: "Seeker",
    providerName: "Provider",
  });

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        cache: "no-store",
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error?.includes("resolved")) {
          setIsResolved(true);
          setIsAccessBlocked(true);
          setError("Dispute is resolved. Chat is archived.");
        } else {
          setIsAccessBlocked(true);
          setError(data.error || "Access Denied");
        }
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data);
      setError(null);
      setIsResolved(false);
      setIsAccessBlocked(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load messages. Retrying...");
      setIsAccessBlocked(false);
    }
  }, [complaintId]);

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        seeker?: { name?: string | null } | null;
        provider?: {
          name?: string | null;
          businessName?: string | null;
        } | null;
      };

      const seekerName = data?.seeker?.name?.trim() || "Seeker";
      const providerName = getProviderParticipantName(data?.provider);

      setParticipants({
        seekerName,
        providerName,
      });
    } catch {
      // Keep safe fallback labels.
    }
  }, [complaintId]);

  useEffect(() => {
    fetchParticipants();
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Polling
    return () => clearInterval(interval);
  }, [fetchMessages, fetchParticipants]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (isResolved || isAccessBlocked || !input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, attachments: [] }), // Attachments UI TBD
      });

      if (!res.ok) {
        let message = "Failed to send message";
        try {
          const d = (await res.json()) as {
            error?: string | { message?: string };
          };
          if (typeof d.error === "string") {
            message = d.error;
          } else if (d.error?.message) {
            message = d.error.message;
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(message);
      }

      setInput("");
      setShouldAutoScroll(true); // Always scroll to bottom after sending
      await fetchMessages();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send message";
      if (message.toLowerCase().includes("resolved")) {
        setIsResolved(true);
        setIsAccessBlocked(true);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-scroll only when user sends a message
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShouldAutoScroll(false);
    }
  }, [messages, shouldAutoScroll]);

  return (
    <div className="flex flex-col h-full bg-background/50 relative rounded-2xl overflow-hidden border border-border/50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-h-100">
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

        {messages.map((msg, i) => {
          const senderRole = normalizeSenderRole(msg.sender_role);
          const isSystemMessage =
            senderRole === "system" ||
            String(msg.message_type).toUpperCase() === "SYSTEM";
          const isSelfMessage = senderRole === selfRole;
          const senderLabel = getSenderLabel(senderRole, participants);

          return (
            <div
              key={msg._id || i}
              className={`flex ${isSelfMessage ? "justify-end" : "justify-start"}`}
            >
              <div className={isSystemMessage ? "w-full" : "max-w-[85%]"}>
                {!isSystemMessage && (
                  <p
                    className={`mb-1 px-1 text-[11px] font-semibold tracking-wide ${
                      isSelfMessage
                        ? "text-primary text-right"
                        : "text-foreground/80"
                    }`}
                  >
                    {senderLabel}
                  </p>
                )}

                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all ${
                    isSelfMessage
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : isSystemMessage
                        ? "bg-muted text-muted-foreground w-full text-center mx-auto text-xs py-1"
                        : "bg-background border border-border rounded-bl-sm"
                  }`}
                >
                  {isSystemMessage ? (
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

                  {!isSystemMessage && (
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
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isResolved && !isAccessBlocked && (
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
