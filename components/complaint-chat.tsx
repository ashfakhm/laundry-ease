"use client";
import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Send,
  Lock,
  Paperclip,
  X,
  Loader2,
  WifiOff,
  Mic,
  Square,
  Trash2,
  Ban,
} from "lucide-react";
import Image from "next/image";
import { useSocket } from "@/components/providers/socket-provider";
import { reportError } from "@/lib/client-error";
import { unwrapApiArray, unwrapApiData } from "@/lib/client-api";
import realtimeContracts, {
  type ComplaintMessageDto,
  type ComplaintStateUpdateDto,
  type TypingStartDto,
  type MessageDeletedDto,
} from "@/lib/realtime/contracts";
import {
  appendUniqueSortedMessages,
  applyMessageDeletion,
  removeMessageLocally,
  CLIENT_EVENTS,
  deriveComplaintUiState,
  deriveComplaintUiStateFromRealtime,
  SERVER_EVENTS,
  sortMessages,
} from "@/lib/realtime/chat-state";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

type ChatMessage = ComplaintMessageDto;

type ComplaintParticipants = {
  seekerName: string;
  providerName: string;
};

type ComplaintOrderTimeline = {
  orderDeadline: string | null;
  deliveredAt: string | null;
};

type SenderRole = "seeker" | "provider" | "admin" | "system";

const TYPING_DEBOUNCE_MS = 2000;

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

function formatTimelineDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default function ComplaintChat({
  complaintId,
  selfRole,
}: {
  complaintId: string;
  selfRole: "seeker" | "provider" | "admin";
}) {
  const { socket, isConnected, isReconnecting } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [participants, setParticipants] = useState<ComplaintParticipants>({
    seekerName: "Seeker",
    providerName: "Provider",
  });
  const [orderTimeline, setOrderTimeline] = useState<ComplaintOrderTimeline>({
    orderDeadline: null,
    deliveredAt: null,
  });
  const hasSocketConnectedRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Voice recorder
  const [pendingVoiceUrl, setPendingVoiceUrl] = useState<string | null>(null);
  const voiceRecorder = useVoiceRecorder({
    folder: "complaint-voice",
    onRecorded: (url) => {
      setPendingVoiceUrl(url);
    },
    onError: (msg) => {
      setVoiceError(msg);
      if (voiceErrorTimerRef.current) clearTimeout(voiceErrorTimerRef.current);
      voiceErrorTimerRef.current = setTimeout(() => setVoiceError(null), 4000);
    },
  });

  const room = realtimeContracts.getComplaintRoom(complaintId);

  const [deleteMenuMsg, setDeleteMenuMsg] = useState<ChatMessage | null>(null);
  const [deleteMenuPos, setDeleteMenuPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [deleting, setDeleting] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openDeleteMenu(msg: ChatMessage, x: number, y: number) {
    if (msg.deletedForEveryone) return;
    setDeleteMenuMsg(msg);
    setDeleteMenuPos({ x, y });
  }

  function closeDeleteMenu() {
    setDeleteMenuMsg(null);
  }

  async function handleDelete(
    mode: "for_me" | "for_everyone" | "admin_hard_delete",
  ) {
    if (!deleteMenuMsg) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/complaints/${complaintId}/messages/${deleteMenuMsg._id}?mode=${mode}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Failed to delete",
        );
      }

      if (mode === "for_me") {
        setMessages((prev) => removeMessageLocally(prev, deleteMenuMsg._id));
      }
      if (mode === "admin_hard_delete") {
        setMessages((prev) => removeMessageLocally(prev, deleteMenuMsg._id));
      }
      // for_everyone is handled by the socket event
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      closeDeleteMenu();
    }
  }

  function canDeleteForEveryone(msg: ChatMessage): boolean {
    const senderRole = normalizeSenderRole(msg.sender_role);
    // Admin can delete any non-system message for everyone (no time limit)
    if (selfRole === "admin" && senderRole !== "system") return true;
    // Regular users can only delete their own messages within the window
    if (senderRole !== selfRole) return false;
    const age = Date.now() - new Date(msg.createdAt).getTime();
    return age <= 60 * 60 * 1000; // 1 hour
  }

  const fetchMessages = useEffectEvent(async () => {
    try {
      const res = await fetch(
        `/api/complaints/${complaintId}/messages?limit=120`,
        {
          cache: "no-store",
        },
      );
      if (res.status === 403 || res.status === 409) {
        const payload = await res.json().catch(() => ({}));
        const message = getApiErrorMessage(payload, "Access Denied");
        if (message.toLowerCase().includes("resolved")) {
          setIsResolved(true);
          setIsAccessBlocked(selfRole !== "admin");
          setError("Dispute is resolved. Chat is archived.");
        } else {
          setIsAccessBlocked(true);
          setError(message);
        }
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch messages");
      const payload = await res.json();
      const data = sortMessages(unwrapApiArray<ChatMessage>(payload));

      setMessages(data);
      setShouldAutoScroll(true);
    } catch (err) {
      reportError("ComplaintMessageFetchError", err);
      setError("Failed to load messages.");
    }
  });

  const fetchComplaintMeta = useEffectEvent(async () => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const payload = await res.json();
      const data = unwrapApiData<{
        status?: string | null;
        provider_access_granted?: boolean;
        order_deadline?: string | null;
        delivered_at?: string | null;
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
      setOrderTimeline({
        orderDeadline: data?.order_deadline ?? null,
        deliveredAt: data?.delivered_at ?? null,
      });

      const uiState = deriveComplaintUiState({
        selfRole,
        status: data?.status,
        providerAccessGranted: data?.provider_access_granted,
      });
      setIsResolved(uiState.isResolved);
      setIsAccessBlocked(uiState.isAccessBlocked);
      setError(uiState.error);
    } catch {
      // Keep safe fallback labels.
    }
  });

  useEffect(() => {
    hasSocketConnectedRef.current = false;
    setMessages([]);
    setError(null);
    setIsResolved(false);
    setIsAccessBlocked(false);
    setPendingAttachments([]);
    setPeerTyping(null);
    setOrderTimeline({ orderDeadline: null, deliveredAt: null });
    void Promise.all([fetchComplaintMeta(), fetchMessages()]);
  }, [complaintId, selfRole]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      socket.emit(
        CLIENT_EVENTS.COMPLAINT_JOIN,
        { complaintId },
        (result?: { ok?: boolean; error?: string }) => {
          if (result?.ok === false) {
            setError(result.error || "Could not join realtime complaint chat");
            return;
          }

          if (hasSocketConnectedRef.current) {
            void Promise.all([fetchComplaintMeta(), fetchMessages()]);
          } else {
            hasSocketConnectedRef.current = true;
          }
        },
      );
    };

    const handleRealtimeMessage = (payload?: { message?: ChatMessage }) => {
      if (!payload?.message?._id) return;
      const message = payload.message;
      setMessages((prev) => appendUniqueSortedMessages(prev, message));
      setShouldAutoScroll(true);
    };

    const handleComplaintStateUpdate = (payload?: ComplaintStateUpdateDto) => {
      if (!payload) return;
      const nextUiState = deriveComplaintUiStateFromRealtime(payload, selfRole);
      setIsResolved(nextUiState.isResolved);
      setIsAccessBlocked(nextUiState.isAccessBlocked);
      setError(nextUiState.error);
    };

    const handleTypingStart = (data: TypingStartDto) => {
      if (data.room === room) {
        setPeerTyping(data.userName || "Someone");
      }
    };

    const handleTypingStop = () => {
      setPeerTyping(null);
    };

    const handleMessageDeleted = (payload?: MessageDeletedDto) => {
      if (!payload?.messageId) return;
      setMessages((prev) => applyMessageDeletion(prev, payload));
    };

    socket.on("connect", handleConnect);
    socket.on(SERVER_EVENTS.COMPLAINT_MESSAGE_CREATED, handleRealtimeMessage);
    socket.on(SERVER_EVENTS.COMPLAINT_MESSAGE_DELETED, handleMessageDeleted);
    socket.on(
      SERVER_EVENTS.COMPLAINT_STATE_UPDATED,
      handleComplaintStateUpdate,
    );
    socket.on(SERVER_EVENTS.TYPING_START, handleTypingStart);
    socket.on(SERVER_EVENTS.TYPING_STOP, handleTypingStop);

    // If already connected when this effect runs, join immediately.
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.emit(CLIENT_EVENTS.ROOM_LEAVE, { room });
      socket.off("connect", handleConnect);
      socket.off(
        SERVER_EVENTS.COMPLAINT_MESSAGE_CREATED,
        handleRealtimeMessage,
      );
      socket.off(SERVER_EVENTS.COMPLAINT_MESSAGE_DELETED, handleMessageDeleted);
      socket.off(
        SERVER_EVENTS.COMPLAINT_STATE_UPDATED,
        handleComplaintStateUpdate,
      );
      socket.off(SERVER_EVENTS.TYPING_START, handleTypingStart);
      socket.off(SERVER_EVENTS.TYPING_STOP, handleTypingStop);
    };
  }, [socket, complaintId, room, selfRole]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  function emitTypingStart() {
    if (!socket || !isConnected) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(CLIENT_EVENTS.TYPING_START, { room });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit(CLIENT_EVENTS.TYPING_STOP, { room });
    }, TYPING_DEBOUNCE_MS);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      emitTypingStart();
    }
  };

  async function uploadAttachments(fileList: FileList | null) {
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
          data?: { url?: string };
          error?: string;
        };
        if (!res.ok || !data.data?.url) {
          throw new Error(data.error || "Failed to upload attachment");
        }

        uploadedUrls.push(data.data.url);
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
  }

  function removePendingAttachment(url: string) {
    setPendingAttachments((prev) => prev.filter((item) => item !== url));
  }

  async function sendMessage(e?: React.FormEvent, voiceUrl?: string) {
    e?.preventDefault();
    const voice = voiceUrl || pendingVoiceUrl;
    if (
      isResolved ||
      isAccessBlocked ||
      (input.trim().length === 0 && pendingAttachments.length === 0 && !voice)
    ) {
      return;
    }
    setLoading(true);
    setError(null);

    // Stop typing indicator on send.
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current && socket) {
      isTypingRef.current = false;
      socket.emit(CLIENT_EVENTS.TYPING_STOP, { room });
    }

    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input.trim(),
          attachments: pendingAttachments,
          voiceMessage: voice || undefined,
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

      const payload = await res.json();
      const message = unwrapApiData<ChatMessage>(payload);
      setInput("");
      setPendingAttachments([]);
      setPendingVoiceUrl(null);
      if (message?._id) {
        setMessages((prev) => appendUniqueSortedMessages(prev, message));
      }
      setShouldAutoScroll(true); // Always scroll to bottom after sending
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send message";
      if (message.toLowerCase().includes("resolved")) {
        setIsResolved(true);
        setIsAccessBlocked(selfRole !== "admin");
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-send when voice recording finishes
  useEffect(() => {
    if (pendingVoiceUrl) {
      void sendMessage(undefined, pendingVoiceUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoiceUrl]);

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
      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <Image
            src={lightboxUrl}
            alt="Full size image"
            width={900}
            height={900}
            sizes="90vw"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Disconnect banner */}
      {!isConnected && hasSocketConnectedRef.current && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium px-3 py-2 animate-pulse">
          <WifiOff className="w-3.5 h-3.5" />
          {isReconnecting ? "Reconnecting..." : "Connection lost"}
        </div>
      )}

      {(orderTimeline.orderDeadline || orderTimeline.deliveredAt) && (
        <div className="border-b border-border/50 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {orderTimeline.orderDeadline && (
              <span>
                Service deadline:{" "}
                {formatTimelineDateTime(orderTimeline.orderDeadline)}
              </span>
            )}
            {orderTimeline.deliveredAt && (
              <span>
                Delivered on:{" "}
                {formatTimelineDateTime(orderTimeline.deliveredAt)}
              </span>
            )}
            {orderTimeline.orderDeadline && orderTimeline.deliveredAt && (
              <span
                className={
                  new Date(orderTimeline.deliveredAt).getTime() <=
                  new Date(orderTimeline.orderDeadline).getTime()
                    ? "text-emerald-600"
                    : "text-amber-600"
                }
              >
                {new Date(orderTimeline.deliveredAt).getTime() <=
                new Date(orderTimeline.orderDeadline).getTime()
                  ? "On-time delivery"
                  : "Deadline exceeded"}
              </span>
            )}
          </div>
        </div>
      )}

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
          const isDeleted = Boolean(msg.deletedForEveryone);
          const canInteract = !isSystemMessage && !isDeleted;

          return (
            <div
              key={msg._id || i}
              className={`flex ${isSelfMessage ? "justify-end" : "justify-start"}`}
            >
              <div className={isSystemMessage ? "w-full" : "max-w-[85%]"}>
                {!isSystemMessage && !isDeleted && (
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
                    isDeleted
                      ? "bg-muted/50 border border-border/30 italic text-muted-foreground rounded-br-sm"
                      : isSelfMessage
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : isSystemMessage
                          ? "bg-muted text-muted-foreground w-full text-center mx-auto text-xs py-1"
                          : "bg-background border border-border rounded-bl-sm"
                  }`}
                  onContextMenu={
                    canInteract
                      ? (e) => {
                          e.preventDefault();
                          openDeleteMenu(msg, e.clientX, e.clientY);
                        }
                      : undefined
                  }
                  onTouchStart={
                    canInteract
                      ? (e) => {
                          const touch = e.touches[0];
                          longPressTimerRef.current = setTimeout(() => {
                            openDeleteMenu(msg, touch.clientX, touch.clientY);
                          }, 500);
                        }
                      : undefined
                  }
                  onTouchEnd={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  onTouchMove={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                >
                  {isDeleted ? (
                    <p className="flex items-center gap-1.5 text-xs">
                      <Ban className="w-3 h-3" />
                      This message was deleted
                    </p>
                  ) : isSystemMessage ? (
                    <span className="italic">{msg.content}</span>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.voiceMessage && (
                        <div className={msg.content ? "mt-2" : ""}>
                          <audio
                            controls
                            preload="metadata"
                            className="w-full max-w-60 h-8"
                            src={msg.voiceMessage}
                          />
                        </div>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div
                          className={`mt-2 grid gap-2 ${msg.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                        >
                          {msg.attachments.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxUrl(url)}
                            >
                              <Image
                                src={url}
                                alt="Complaint evidence image"
                                width={128}
                                height={128}
                                sizes="128px"
                                className="object-cover w-full h-full"
                              />
                            </button>
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

        {/* Typing indicator */}
        {peerTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-muted/60 text-muted-foreground text-xs italic animate-pulse rounded-bl-sm">
              {peerTyping} is typing…
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice permission error banner */}
      {voiceError && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t bg-destructive/10 text-destructive text-sm font-medium">
          <Mic className="w-4 h-4 shrink-0" />
          <span className="flex-1">{voiceError}</span>
          <button
            type="button"
            className="p-0.5 rounded hover:bg-destructive/20 transition-colors"
            onClick={() => setVoiceError(null)}
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Voice recording indicator */}
      {voiceRecorder.isRecording && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-t bg-red-500/10 animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            Recording… {Math.floor(voiceRecorder.duration / 60)}:
            {String(voiceRecorder.duration % 60).padStart(2, "0")}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="p-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              onClick={voiceRecorder.cancelRecording}
              title="Cancel recording"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              onClick={voiceRecorder.stopRecording}
              title="Stop and send"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Voice uploading indicator */}
      {voiceRecorder.isUploading && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 border-t bg-primary/5">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Sending voice message…
          </span>
        </div>
      )}

      {/* Input Area */}
      {!isResolved &&
        !isAccessBlocked &&
        !voiceRecorder.isRecording &&
        !voiceRecorder.isUploading && (
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
                      sizes="96px"
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
                onChange={handleInputChange}
                placeholder="Type a message..."
                disabled={loading}
              />

              {/* Show mic button when no text/attachments, otherwise send */}
              {input.trim().length === 0 && pendingAttachments.length === 0 ? (
                <button
                  type="button"
                  className="p-2.5 border border-border rounded-full text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  onClick={voiceRecorder.startRecording}
                  disabled={loading || uploadingAttachments}
                  title="Send voice message"
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
                  type="submit"
                  disabled={loading || uploadingAttachments}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              )}
            </div>
          </form>
        )}

      {/* Delete context menu */}
      {deleteMenuMsg && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeDeleteMenu} />
          <div
            className="fixed z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-48 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: Math.min(
                deleteMenuPos.x,
                typeof window !== "undefined" ? window.innerWidth - 200 : 200,
              ),
              top: Math.min(
                deleteMenuPos.y,
                typeof window !== "undefined" ? window.innerHeight - 160 : 200,
              ),
            }}
          >
            <button
              type="button"
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50"
              onClick={() => handleDelete("for_me")}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
              Delete for me
            </button>
            {canDeleteForEveryone(deleteMenuMsg) && (
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50"
                onClick={() => handleDelete("for_everyone")}
                disabled={deleting}
              >
                <Ban className="w-4 h-4" />
                Delete for everyone
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
