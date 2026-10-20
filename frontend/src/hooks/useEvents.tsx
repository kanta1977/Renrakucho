"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { WS_BASE_URL } from "@/lib/config";
import type { ServerEvent } from "@/lib/types";

import { useAuth } from "./useAuth";

export type ConnectionStatus = "connecting" | "open" | "closed";

type Listener = (e: ServerEvent) => void;

type EventsContextValue = {
  status: ConnectionStatus;
  subscribe: (fn: Listener) => () => void;
};

const EventsContext = createContext<EventsContextValue | null>(null);

const MAX_BACKOFF_MS = 10_000;

// WebSocket を1本だけ張り、届いた知らせを各画面に配る。切れたら間隔をあけてつなぎ直す
export function EventsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const listeners = useRef(new Set<Listener>());
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const emit = useCallback((e: ServerEvent) => {
    for (const fn of listeners.current) fn(e);
  }, []);

  useEffect(() => {
    if (!token) return;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      setStatus("connecting");
      ws = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => {
        if (retry > 0) emit({ type: "reconnected" });
        retry = 0;
        setStatus("open");
      };
      ws.onmessage = (ev) => {
        try {
          emit(JSON.parse(ev.data) as ServerEvent);
        } catch {
          /* 読めないデータは無視する */
        }
      };
      ws.onclose = () => {
        setStatus("closed");
        if (disposed) return;
        const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** retry++);
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [token, emit]);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  return <EventsContext.Provider value={{ status, subscribe }}>{children}</EventsContext.Provider>;
}

function useEventsContext(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("must be used inside <EventsProvider>");
  return ctx;
}

export function useServerEvents(fn: Listener) {
  const { subscribe } = useEventsContext();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}

export function useConnectionStatus(): ConnectionStatus {
  return useEventsContext().status;
}
