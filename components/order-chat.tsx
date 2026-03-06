"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, WifiOff } from "lucide-react";
import { useSocket } from "@/components/providers/socket-provider";
import { unwrapApiArray, unwrapApiData } from "@/lib/client-api";
import realtimeContracts, {
  type OrderChatMessageDto,
  type TypingStartDto,
} from "@/lib/realtime/contracts";
import {
  appendUniqueSortedMessages,
  CLIENT_EVENTS,
  SERVER_EVENTS,
  sortMessages,
} from "@/lib/realtime/chat-state";

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

  const room = realtimeContracts.getOrderRoom(orderId);

  /* ---- Fetch messages from REST API ---- */
  const fetchMessages = useCallback(async () => {
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
  }, [orderId]);

  /* ---- Initial fetch ---- */
  useEffect(() => {
    setLoadingMessages(true);
    setMessages([]);
    hasSocketConnectedRef.current = false;
    void fetchMessages();
  }, [fetchMessages]);

  /* ---- Socket.IO lifecycle ---- */
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

    socket.on("connect", handleConnect);
    socket.on(
      SERVER_EVENTS.ORDER_MESSAGE_CREATED,
      handleRealtimeMessage,
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
        SERVER_EVENTS.ORDER_MESSAGE_CREATED,
        handleRealtimeMessage,
      );
      socket.off(SERVER_EVENTS.TYPING_START, handleTypingStart);
      socket.off(SERVER_EVENTS.TYPING_STOP, handleTypingStop);
    };
  }, [socket, orderId, room, fetchMessages]);

  /* ---- Typing indicator ---- */
  const emitTypingStart = useCallback(() => {
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
  }, [socket, isConnected, room]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      emitTypingStart();
    }
  };

  /* ---- Send message ---- */
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
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
        body: JSON.stringify({ message: input }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const payload = await res.json();
      const message = unwrapApiData<ChatMessage>(payload);
      setInput("");
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
                msg.sender_role === selfRole
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-background border border-border rounded-bl-sm"
              }`}
            >
              <p>{msg.message}</p>
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

      {/* Input Area */}
      <form
        onSubmit={sendMessage}
        className="flex gap-2 p-3 border-t bg-card/80 backdrop-blur-sm"
      >
        <input
          className="flex-1 bg-muted/50 border border-transparent focus:border-primary/20 focus:bg-background rounded-full px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/70"
          value={input}
          onChange={handleInputChange}
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
    </div>
  );
}
