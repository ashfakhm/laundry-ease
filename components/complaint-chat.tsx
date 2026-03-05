"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Lock, Paperclip, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { reportError } from "@/lib/client-error";
import { unwrapApiArray, unwrapApiData } from "@/lib/client-api";

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

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: { message?: unknown } }).error?.message ===
      "string"
  ) {
    return (payload as { error: { message: string } }).error.message;
  }

  return fallback;
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
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [participants, setParticipants] = useState<ComplaintParticipants>({
    seekerName: "Seeker",
    providerName: "Provider",
  });
  const latestMessageAtRef = useRef<string | null>(null);

  const fetchMessages = useCallback(
    async (incremental = false) => {
      try {
        const query = new URLSearchParams({
          limit: "120",
        });
        if (incremental && latestMessageAtRef.current) {
          query.set("since", latestMessageAtRef.current);
        }

        const res = await fetch(
          `/api/complaints/${complaintId}/messages?${query}`,
          {
            cache: "no-store",
          },
        );
        if (res.status === 403) {
          const payload = await res.json().catch(() => ({}));
          const message = getApiErrorMessage(payload, "Access Denied");
          if (message.toLowerCase().includes("resolved")) {
            setIsResolved(true);
            setIsAccessBlocked(true);
            setError("Dispute is resolved. Chat is archived.");
          } else {
            setIsAccessBlocked(true);
            setError(message);
          }
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch messages");
        const payload = await res.json();
        const data = unwrapApiArray<ChatMessage>(payload);

        const sortByTime = (msgs: ChatMessage[]) =>
          msgs.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime() ||
              (a._id ?? "").localeCompare(b._id ?? ""),
          );

        if (incremental && latestMessageAtRef.current) {
          if (data.length > 0) {
            latestMessageAtRef.current = data[data.length - 1].createdAt;
            setMessages((prev) => {
              const seen = new Set(prev.map((msg) => String(msg._id)));
              const appended = data.filter((msg) => !seen.has(String(msg._id)));
              return appended.length > 0
                ? sortByTime([...prev, ...appended])
                : prev;
            });
            setShouldAutoScroll(true);
          }
        } else {
          setMessages(sortByTime(data));
          latestMessageAtRef.current =
            data.length > 0 ? data[data.length - 1].createdAt : null;
          setShouldAutoScroll(true);
        }

        setError(null);
        setIsResolved(false);
        setIsAccessBlocked(false);
      } catch (err) {
        reportError("ComplaintMessageFetchError", err);
        setError("Failed to load messages. Retrying...");
        setIsAccessBlocked(false);
      }
    },
    [complaintId],
  );

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const payload = await res.json();
      const data = unwrapApiData<{
        seeker?: { name?: string | null } | null;
        provider?: {
          name?: string | null;
          businessName?: string | null;
        } | null;
      }>(payload);

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
    fetchMessages(false);
    const interval = setInterval(() => {
      void fetchMessages(true);
    }, 5000); // Polling
    return () => clearInterval(interval);
  }, [fetchMessages, fetchParticipants]);

  const uploadAttachments = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const currentCount = pendingAttachments.length;
      const remainingSlots = Math.max(0, 5 - currentCount);
      if (remainingSlots === 0) {
        setError("You can attach up to 5 images per message.");
        return;
      }

      const files = Array.from(fileList).slice(0, remainingSlots);
      setUploadingAttachments(true);
      setError(null);

      try {
        const uploadedUrls: string[] = [];

        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("folder", "complaint-evidence");

          const res = await fetch("/api/upload/image", {
            method: "POST",
            body: formData,
          });

          const data = (await res.json().catch(() => ({}))) as {
            url?: string;
            error?: string;
          };
          if (!res.ok || !data.url) {
            throw new Error(data.error || "Failed to upload attachment");
          }

          uploadedUrls.push(data.url);
        }

        setPendingAttachments((prev) =>
          Array.from(new Set([...prev, ...uploadedUrls])).slice(0, 5),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to upload attachment";
        setError(message);
      } finally {
        setUploadingAttachments(false);
      }
    },
    [pendingAttachments.length],
  );

  function removePendingAttachment(url: string) {
    setPendingAttachments((prev) => prev.filter((item) => item !== url));
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (
      isResolved ||
      isAccessBlocked ||
      (input.trim().length === 0 && pendingAttachments.length === 0)
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input.trim(),
          attachments: pendingAttachments,
        }),
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
      setPendingAttachments([]);
      setShouldAutoScroll(true); // Always scroll to bottom after sending
      await fetchMessages(false);
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
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
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
                      {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "Asia/Kolkata",
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
          className="p-3 border-t bg-card/80 backdrop-blur-sm space-y-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              void uploadAttachments(e.target.files);
              e.currentTarget.value = "";
            }}
          />

          {pendingAttachments.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {pendingAttachments.map((url) => (
                <div
                  key={url}
                  className="relative rounded-xl overflow-hidden border border-border/60 bg-muted"
                >
                  <Image
                    src={url}
                    alt="Pending attachment preview"
                    width={96}
                    height={96}
                    className="w-full aspect-square object-cover"
                  />
                  <button
                    type="button"
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/75"
                    onClick={() => removePendingAttachment(url)}
                    disabled={loading || uploadingAttachments}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="p-2.5 border border-border rounded-full text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={
                loading ||
                uploadingAttachments ||
                pendingAttachments.length >= 5
              }
              title="Attach images"
            >
              {uploadingAttachments ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
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
              disabled={
                loading ||
                uploadingAttachments ||
                (input.trim().length === 0 && pendingAttachments.length === 0)
              }
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
