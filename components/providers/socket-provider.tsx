"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SocketContextValue {
  /** The shared Socket.IO instance — `null` until the socket connects. */
  socket: Socket | null;
  /** `true` once the socket has a live transport connection. */
  isConnected: boolean;
  /** `true` while the socket is attempting to reconnect after a drop. */
  isReconnecting: boolean;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

/**
 * Provides a single Socket.IO connection per authenticated session.
 * All chat components share this connection via `useSocket()`.
 *
 * Design constraints satisfied:
 * - `react-hooks/set-state-in-effect`: setState is NEVER called
 *   synchronously in the effect body — only inside socket event
 *   callbacks (connect, disconnect, reconnect_attempt, etc.).
 * - `react-hooks/refs`: `socketRef.current` is never read during
 *   render — the ref is only accessed inside the effect and cleanup.
 *
 * The `socket` exposed in context is a piece of React state set inside
 * the `connect` event callback. This means it becomes non-null on first
 * successful connection and goes back to null when the socket is torn
 * down. Consumers' effects depend on `socket` and therefore re-run
 * whenever the socket instance changes.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // Ref holds the raw socket so the cleanup function can call
  // `disconnect()` without needing `socket` (state) in its closure.
  // The ref is never read during render — only inside the effect.
  const socketRef = useRef<Socket | null>(null);

  // These drive UI re-renders. They are set exclusively inside socket
  // event callbacks — never synchronously at the top of the effect body.
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Only create a socket when the user is authenticated.
    if (status !== "authenticated" || !session?.user) return;

    const s = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ["websocket", "polling"],
    });

    // Store in ref so the cleanup can reach it without reading state.
    socketRef.current = s;

    // ---- Event callbacks (setState calls live here, not in effect body) ----

    s.on("connect", () => {
      // Expose the instance to consumers only after first connect so
      // consumers' effects that check `socket.connected` work correctly.
      setSocket(s);
      setIsConnected(true);
      setIsReconnecting(false);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
    });

    s.on("connect_error", () => {
      setIsConnected(false);
    });

    s.io.on("reconnect_attempt", () => {
      setIsReconnecting(true);
    });

    s.io.on("reconnect", () => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    // ---- Cleanup ----
    // The cleanup function is NOT the synchronous effect body — it runs
    // when deps change or the component unmounts, so setState calls here
    // do not violate the set-state-in-effect rule.
    return () => {
      socketRef.current = null;
      s.removeAllListeners();
      s.io.removeAllListeners();
      s.disconnect();
      // Reset all derived state so consumers know the socket is gone.
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [status, session?.user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/** Access the shared Socket.IO connection and its state. */
export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
