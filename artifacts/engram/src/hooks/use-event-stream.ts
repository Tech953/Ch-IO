import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type EngramEventType =
  | "presence.changed"
  | "controls.changed"
  | "simulation.step"
  | "media.completed"
  | "artifact.created"
  | "artifact.updated"
  | "artifact.completed"
  | "artifact.failed"
  | "chat.self_initiated"
  | "message.created";

export interface EngramEvent {
  type: EngramEventType;
  engramId?: number | null;
  conversationId?: number | null;
  data?: unknown;
  ts: string;
}

export interface EventStreamScope {
  engramId?: number | null;
  conversationId?: number | null;
}

/**
 * Subscribe to the server's live event stream (SSE at `/api/events`). The browser's
 * EventSource handles reconnection. The latest `onEvent` is held in a ref so a new
 * callback identity each render does NOT tear down the stream — it only reopens when
 * the scope (engramId/conversationId) changes. Returns whether the stream is open.
 */
export function useEventStream(
  scope: EventStreamScope,
  onEvent: (event: EngramEvent) => void,
): boolean {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const [connected, setConnected] = useState(false);

  const engramId = scope.engramId ?? undefined;
  const conversationId = scope.conversationId ?? undefined;

  useEffect(() => {
    const params = new URLSearchParams();
    if (engramId != null) params.set("engramId", String(engramId));
    if (conversationId != null) params.set("conversationId", String(conversationId));
    const qs = params.toString();
    const url = `${BASE}/api/events${qs ? `?${qs}` : ""}`;

    const source = new EventSource(url);
    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      try {
        handlerRef.current(JSON.parse(e.data) as EngramEvent);
      } catch {
        /* ignore malformed frame */
      }
    };
    source.onerror = () => {
      // EventSource auto-reconnects; reflect the transient drop in the indicator.
      setConnected(false);
    };

    return () => {
      setConnected(false);
      source.close();
    };
  }, [engramId, conversationId]);

  return connected;
}
