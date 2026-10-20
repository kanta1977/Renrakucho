"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

import { useServerEvents } from "./useEvents";

// id 順に並べ、重複を除く（自分の送信は POST の返事と WebSocket の両方で届くため）
function merge(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function useTalk(roomId: number, token: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markRead = useCallback(() => {
    api.markRead(token, roomId).catch(() => {});
  }, [token, roomId]);

  const loadLatest = useCallback(async (replace = false) => {
    try {
      const page = await api.listMessages(token, roomId);
      setMessages((cur) => (replace ? page.items : merge(cur, page.items)));
      setHasMore((prev) => prev || page.has_more);
      setError(null);
      markRead();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, roomId, markRead]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const page = await api.listMessages(token, roomId, messages[0].id);
      setMessages((cur) => merge(cur, page.items));
      setHasMore(page.has_more);
    } finally {
      setLoadingOlder(false);
    }
  }, [token, roomId, loadingOlder, hasMore, messages]);

  useServerEvents((e) => {
    if (e.type === "message.created" && e.data.room_id === roomId) {
      setMessages((cur) => merge(cur, [e.data]));
      markRead();
    } else if (e.type === "reconnected") {
      loadLatest();
    } else if (e.type === "friends.changed") {
      // 友達が変わると掲示板の見える範囲も変わるので、読み込み直す
      loadLatest(true);
    }
  });

  const send = useCallback(
    async (content: string, mentionUserId?: number | null) => {
      const msg = await api.sendMessage(token, roomId, content, mentionUserId);
      setMessages((cur) => merge(cur, [msg]));
    },
    [token, roomId],
  );

  return { messages, hasMore, loading, loadingOlder, error, loadOlder, send };
}
