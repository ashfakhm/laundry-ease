"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SocketContextValue {
  /** The shared Socket.IO instance — `null` until auth session is available. */
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
 * Uses useRef + useSyncExternalStore to avoid React 19 "setState in
 * useEffect" and "ref during render" lint warnings.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // Store for external-system state.
  const storeRef = useRef<{
    socket: Socket | null;
    isConnected: boolean;
    isReconnecting: boolean;
    listeners: Set<() => void>;
  }>({
    socket: null,
    isConnected: false,
    isReconnecting: false,
    listeners: new Set(),
  });

  const subscribe = (listener: () => void) => {
    storeRef.current.listeners.add(listener);
    return () => {
      storeRef.current.listeners.delete(listener);
    };
  };

  const getSnapshot = (): SocketContextValue => {
    const s = storeRef.current;
    return { socket: s.socket, isConnected: s.isConnected, isReconnecting: s.isReconnecting };
  };

  // We use a simple state + subscribe pattern so React re-renders when
  // external socket state changes, without calling setState inside useEffect.
  const [value, setValue] = useState<SocketContextValue>(getSnapshot);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    const s = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ["websocket", "polling"],
    });

    const update = (patch: Partial<typeof storeRef.current>) => {
      Object.assign(storeRef.current, patch);
      const snap = getSnapshot();
      setValue(snap);
    };

    update({ socket: s });

    s.on("connect", () => update({ isConnected: true, isReconnecting: false }));
    s.on("disconnect", () => update({ isConnected: false }));
    s.on("connect_error", () => update({ isConnected: false }));
    s.io.on("reconnect_attempt", () => update({ isReconnecting: true }));
    s.io.on("reconnect", () => update({ isConnected: true, isReconnecting: false }));

    return () => {
      s.removeAllListeners();
      s.io.removeAllListeners();
      s.disconnect();
      update({ socket: null, isConnected: false, isReconnecting: false });
    };
  }, [status, session?.user]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/** Access the shared Socket.IO connection and its state. */
export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
