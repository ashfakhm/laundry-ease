"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import BookingChat from "@/components/chat-interface";
import {
  MessageSquare,
  Search,
  MoreVertical,
  Phone,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type ChatPreview = {
  _id: string; // booking_id
  status: string;
  createdAt: string;
  seeker: {
    name: string;
    email: string;
    phone?: string;
  };
  lastMessage?: {
    text: string;
    sender: string;
    timestamp: string;
  };
  messageCount: number;
};

export default function ProviderMessagesPage() {
  const { data: session } = useSession();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Mobile view state
  const [showMobileList, setShowMobileList] = useState(true);

  useEffect(() => {
    async function fetchChats() {
      try {
        const res = await fetch("/api/provider/chats");
        if (res.ok) {
          const data = await res.json();
          setChats(data);
        }
      } catch (err) {
        console.error("Failed to fetch chats", err);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchChats();
    }
  }, [session]);

  const filteredChats = chats.filter((chat) =>
    chat.seeker.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const activeChat = chats.find((c) => c._id === selectedChatId);

  // Handle back button on mobile
  const handleBackToMenu = () => {
    setShowMobileList(true);
    setSelectedChatId(null);
  };

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setShowMobileList(false);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background/50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-background flex overflow-hidden">
      {/* LEFT COLUMN: Chat List */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col transition-all absolute md:relative z-20 h-full",
          !showMobileList && "hidden md:flex",
        )}
      >
        <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Messages
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/40 border border-transparent focus:bg-background focus:border-primary/50 outline-none text-sm transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filteredChats.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">No conversations found.</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat._id}
                onClick={() => handleSelectChat(chat._id)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl transition-all duration-200 group relative border",
                  selectedChatId === chat._id
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                    : "bg-background border-transparent hover:bg-muted/50 hover:border-border",
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm",
                      selectedChatId === chat._id
                        ? "bg-white/20 text-white"
                        : "bg-linear-to-br from-primary/10 to-purple-500/10 text-primary",
                    )}
                  >
                    {chat.seeker.name.charAt(0)}
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2",
                        selectedChatId === chat._id
                          ? "border-primary bg-green-400"
                          : "border-background bg-green-500",
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3
                        className={cn(
                          "font-bold truncate",
                          selectedChatId === chat._id
                            ? "text-white"
                            : "text-foreground",
                        )}
                      >
                        {chat.seeker.name}
                      </h3>
                      {chat.lastMessage && (
                        <span
                          className={cn(
                            "text-[10px]",
                            selectedChatId === chat._id
                              ? "text-white/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatDistanceToNow(
                            new Date(chat.lastMessage.timestamp),
                            { addSuffix: false },
                          ).replace("about ", "")}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-xs truncate",
                        selectedChatId === chat._id
                          ? "text-white/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {chat.lastMessage ? (
                        chat.lastMessage.sender === session?.user?.id ? (
                          `You: ${chat.lastMessage.text}`
                        ) : (
                          chat.lastMessage.text
                        )
                      ) : (
                        <span className="italic">No messages yet</span>
                      )}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full",
                          selectedChatId === chat._id
                            ? "bg-white/20 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        #{chat._id.slice(-6).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold",
                          selectedChatId === chat._id
                            ? "text-white/60"
                            : "text-primary",
                        )}
                      >
                        {chat.status}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Chat */}
      <div
        className={cn(
          "flex-1 flex flex-col bg-muted/20 h-full absolute inset-0 md:static z-30 md:z-auto transition-transform duration-300",
          showMobileList
            ? "translate-x-full md:translate-x-0 opacity-0 md:opacity-100"
            : "translate-x-0 opacity-100",
        )}
      >
        {activeChat ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToMenu}
                  className="md:hidden p-2 -ml-2 rounded-full hover:bg-muted"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                  {activeChat.seeker.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-heading font-bold text-foreground leading-tight">
                    {activeChat.seeker.name}
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    Booking #{activeChat._id.slice(-6).toUpperCase()}
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-green-600 font-medium">Online</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeChat.seeker.phone && (
                  <a
                    href={`tel:${activeChat.seeker.phone}`}
                    className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                <button className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content using existing Chat Component */}
            <div className="flex-1 overflow-hidden relative">
              <BookingChat bookingId={activeChat._id} selfRole="provider" />
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground/50">
            <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-6 animate-pulse">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-foreground/40 font-heading">
              No Chat Selected
            </h3>
            <p className="text-sm">
              Select a conversation from the left to start chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
