"use client";
import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  Send,
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
import { unwrapApiArray, unwrapApiData } from "@/lib/client-api";
import realtimeContracts, {
  type OrderChatMessageDto,
  type TypingStartDto,
  type MessageDeletedDto,
} from "@/lib/realtime/contracts";
import {
  appendUniqueSortedMessages,
  applyMessageDeletion,
  removeMessageLocally,
  CLIENT_EVENTS,
  SERVER_EVENTS,
  sortMessages,
} from "@/lib/realtime/chat-state";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

type ChatMessage = OrderChatMessageDto & {
  sender_role: "seeker" | "provider";
};

const TYPING_DEBOUNCE_MS = 2000;

export default function OrderChat({
  orderId,
  selfRole,
}: {
  orderId: string;
  selfRole: "seeker" | "provider";
}) {
  const { socket, isConnected, isReconnecting } = useSocket();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const hasSocketConnectedRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const [peerTyping, setPeerTyping] = useState<string | null>(null);

  // Photo upload state
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Voice recorder
  const [pendingVoiceUrl, setPendingVoiceUrl] = useState<string | null>(null);
  const voiceRecorder = useVoiceRecorder({
    folder: "order-chat-voice",
    onRecorded: (url) => {
      setPendingVoiceUrl(url);
    },
    onError: (msg) => setError(msg),
  });

  const room = realtimeContracts.getOrderRoom(orderId);

  // Delete menu state
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

  async function handleDelete(mode: "for_me" | "for_everyone") {
    if (!deleteMenuMsg) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/orders/${orderId}/chat/${deleteMenuMsg._id}?mode=${mode}`,
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
      // for_everyone is handled by the socket event
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      closeDeleteMenu();
    }
  }

  function canDeleteForEveryone(msg: ChatMessage): boolean {
    if (msg.sender_role !== selfRole) return false;
    const age = Date.now() - new Date(msg.createdAt).getTime();
    return age <= 60 * 60 * 1000; // 1 hour
  }

  const fetchMessages = useEffectEvent(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/chat`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load");

      const payload = await res.json();
      const data = sortMessages(unwrapApiArray<ChatMessage>(payload));
      setMessages(data);
      setError(null);
      setShouldAutoScroll(true);
    } catch {
      setError("Could not load chat");
    } finally {
      setLoadingMessages(false);
    }
  });

  useEffect(() => {
    setLoadingMessages(true);
    setMessages([]);
    setError(null);
    setPeerTyping(null);
    setPendingAttachments([]);
    hasSocketConnectedRef.current = false;
    void fetchMessages();
  }, [orderId]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      socket.emit(
        CLIENT_EVENTS.ORDER_JOIN,
        { orderId },
        (result?: { ok?: boolean; error?: string }) => {
          if (result?.ok === false) {
            setError(result.error || "Could not join realtime chat");
            return;
          }

          // On reconnect, re-fetch to pick up any messages missed during disconnect
          if (hasSocketConnectedRef.current) {
            void fetchMessages();
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
    socket.on(SERVER_EVENTS.ORDER_MESSAGE_CREATED, handleRealtimeMessage);
    socket.on(SERVER_EVENTS.ORDER_MESSAGE_DELETED, handleMessageDeleted);
    socket.on(SERVER_EVENTS.TYPING_START, handleTypingStart);
    socket.on(SERVER_EVENTS.TYPING_STOP, handleTypingStop);

    // If already connected when this effect runs, join immediately.
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.emit(CLIENT_EVENTS.ROOM_LEAVE, { room });
      socket.off("connect", handleConnect);
      socket.off(SERVER_EVENTS.ORDER_MESSAGE_CREATED, handleRealtimeMessage);
      socket.off(SERVER_EVENTS.ORDER_MESSAGE_DELETED, handleMessageDeleted);
      socket.off(SERVER_EVENTS.TYPING_START, handleTypingStart);
      socket.off(SERVER_EVENTS.TYPING_STOP, handleTypingStop);
    };
  }, [socket, orderId, room]);

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

  /* ---- Upload attachments ---- */
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
          formData.append("folder", "order-chat");

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

  /* ---- Send message ---- */
  async function sendMessage(e?: React.FormEvent, voiceUrl?: string) {
    e?.preventDefault();
    const voice = voiceUrl || pendingVoiceUrl;
    if (input.trim().length === 0 && pendingAttachments.length === 0 && !voice)
      return;
    setLoading(true);
    setError(null);

    // Stop typing indicator on send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current && socket) {
      isTypingRef.current = false;
      socket.emit(CLIENT_EVENTS.TYPING_STOP, { room });
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim() || undefined,
          attachments:
            pendingAttachments.length > 0 ? pendingAttachments : undefined,
          voiceMessage: voice || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const payload = await res.json();
      const message = unwrapApiData<ChatMessage>(payload);
      setInput("");
      setPendingAttachments([]);
      setPendingVoiceUrl(null);
      if (message?._id) {
        setMessages((prev) => appendUniqueSortedMessages(prev, message));
      }
      setShouldAutoScroll(true);
    } catch {
      setError("Could not send message");
    } finally {
      setLoading(false);
    }
  }

  // Auto-send when voice recording finishes and produces a URL
  useEffect(() => {
    if (pendingVoiceUrl) {
      void sendMessage(undefined, pendingVoiceUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoiceUrl]);

  /* ---- Auto-scroll ---- */
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
    <div className="flex flex-col h-full bg-background/50 relative">
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {messages.length === 0 && !loadingMessages && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
            <div className="p-3 bg-muted rounded-full">
              <Send className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium">Start the conversation</p>
          </div>
        )}

        {loadingMessages && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
                msg.deletedForEveryone
                  ? "bg-muted/50 border border-border/30 italic text-muted-foreground rounded-br-sm"
                  : msg.sender_role === selfRole
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-background border border-border rounded-bl-sm"
              }`}
              onContextMenu={(e) => {
                if (msg.deletedForEveryone) return;
                e.preventDefault();
                openDeleteMenu(msg, e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                if (msg.deletedForEveryone) return;
                const touch = e.touches[0];
                longPressTimerRef.current = setTimeout(() => {
                  openDeleteMenu(msg, touch.clientX, touch.clientY);
                }, 500);
              }}
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
              {msg.deletedForEveryone ? (
                <p className="flex items-center gap-1.5 text-xs">
                  <Ban className="w-3 h-3" />
                  This message was deleted
                </p>
              ) : (
                <>
                  {msg.message && (
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  )}
                  {msg.voiceMessage && (
                    <div className={msg.message ? "mt-2" : ""}>
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
                      className={`grid gap-2 ${msg.message || msg.voiceMessage ? "mt-2" : ""} ${msg.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
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
                            alt="Shared image"
                            width={128}
                            height={128}
                            className="object-cover w-full h-full"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="text-[10px] mt-1 text-right opacity-60 leading-none">
                {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kolkata",
                })}
              </div>
            </div>
          </div>
        ))}

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
      {!voiceRecorder.isRecording && !voiceRecorder.isUploading && (
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

          {/* Pending attachment previews */}
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

      {error && (
        <div className="text-destructive text-xs p-2 text-center bg-destructive/5 font-medium">
          {error}
        </div>
      )}

      {/* Delete context menu */}
      {deleteMenuMsg && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeDeleteMenu} />
          <div
            className="fixed z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-48 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: Math.min(deleteMenuPos.x, window.innerWidth - 200),
              top: Math.min(deleteMenuPos.y, window.innerHeight - 120),
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
