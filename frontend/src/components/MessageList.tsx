"use client";

import { Fragment, useLayoutEffect, useRef } from "react";

import { formatDateLabel, formatTime, isSameDay } from "@/lib/format";
import type { Message } from "@/lib/types";

import styles from "./MessageList.module.css";

type Props = {
  messages: Message[];
  myId: number;
  showNames: boolean;
  loading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
};

const NEAR_BOTTOM_PX = 160;

export function MessageList({ messages, myId, showNames, loading, hasMore, loadingOlder, onLoadOlder }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prev = useRef({ firstId: 0, lastId: 0, height: 0, nearBottom: true });

  // 前の連絡を足したときは表示位置を保つ。新着は、一番下を見ていたときか自分の書き込みなら下まで送る
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    const first = messages[0].id;
    const last = messages[messages.length - 1];
    const p = prev.current;
    if (p.firstId && first < p.firstId && last.id === p.lastId) {
      el.scrollTop += el.scrollHeight - p.height;
    } else if (last.id !== p.lastId && (p.nearBottom || last.user.id === myId || !p.lastId)) {
      el.scrollTop = el.scrollHeight;
    }
    prev.current = { ...p, firstId: first, lastId: last.id, height: el.scrollHeight };
  }, [messages, myId]);

  function handleScroll() {
    const el = scrollRef.current!;
    prev.current.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    prev.current.height = el.scrollHeight;
  }

  return (
    <div ref={scrollRef} className={styles.scroll} onScroll={handleScroll} role="log" aria-live="polite">
      <div className={styles.inner}>
        {/* 自動で読み込まず、ボタンを押したときだけ前の連絡を出す */}
        {hasMore && (
          <button className={`btn btn-outline ${styles.older}`} onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder ? "読みこんでいます…" : "前の連絡を見る"}
          </button>
        )}

        {loading && <p className={styles.empty}>読みこんでいます…</p>}
        {!loading && messages.length === 0 && (
          <p className={styles.empty}>
            まだ連絡はありません。
            <br />
            下の欄に書いて「送る」を押してください。
          </p>
        )}

        {messages.map((m, i) => {
          const mine = m.user.id === myId;
          const toMe = m.mention?.id === myId;
          const newDay = i === 0 || !isSameDay(messages[i - 1].created_at, m.created_at);
          return (
            <Fragment key={m.id}>
              {newDay && <p className={styles.date}>{formatDateLabel(m.created_at)}</p>}
              <article className={`${styles.item} ${mine ? styles.mine : styles.other} ${toMe ? styles.toMe : ""}`}>
                {!mine && showNames && <p className={styles.name}>{m.user.username}さん</p>}
                {mine && showNames && <p className={styles.name}>あなた</p>}
                {m.mention && <p className={styles.mention}>→ {toMe ? "あなた" : `${m.mention.username}さん`}へ</p>}
                <p className={styles.bubble}>{m.content}</p>
                <time className={styles.time} dateTime={m.created_at}>
                  {formatTime(m.created_at)}
                </time>
              </article>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
