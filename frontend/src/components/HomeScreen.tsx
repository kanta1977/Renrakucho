"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useServerEvents } from "@/hooks/useEvents";
import { api } from "@/lib/api";
import { formatCode, formatDateLabel, formatWhen } from "@/lib/format";
import type { Conversation, Home } from "@/lib/types";

import { AddFriendForm } from "./AddFriendForm";
import { Avatar } from "./Avatar";
import { ConnectionNotice } from "./ConnectionNotice";
import styles from "./HomeScreen.module.css";

type Props = { token: string; onSwitchUser: () => void; onAuthError: () => void };

// はじめの画面。掲示板・友達一覧・友達の追加をこの1画面にまとめている
export function HomeScreen({ token, onSwitchUser, onAuthError }: Props) {
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .home(token)
      .then((h) => {
        setHome(h);
        setError(null);
      })
      .catch((e) => {
        if (e.status === 401) onAuthError();
        else setError(e.message);
      });
  }, [token, onAuthError]);

  useEffect(load, [load]);
  useServerEvents(load); // 新着や友達の変化があったら取り直す

  const handleFind = useCallback((code: string) => api.findByCode(token, code), [token]);
  const handleAdd = useCallback(
    async (code: string) => {
      await api.addFriend(token, code);
      load();
    },
    [token, load],
  );

  // 同じ名前の友達がいるときは「いつ友達になったか」で見分ける
  const sameNames = new Set<string>();
  if (home) {
    const seen = new Set<string>();
    for (const f of home.friends) {
      if (seen.has(f.user.username)) sameNames.add(f.user.username);
      seen.add(f.user.username);
    }
  }

  return (
    <div className={styles.page}>
      <ConnectionNotice />
      <header className={styles.header}>
        <p className={styles.appName}>れんらく帳</p>
        <h1 className={styles.greeting}>{home ? `こんにちは、${home.me.username}さん` : "読みこんでいます…"}</h1>
        {home && (
          <p className={styles.myCode}>
            あなたのお友達番号 <strong>{formatCode(home.me.friend_code)}</strong>
          </p>
        )}
      </header>

      <main className={styles.main}>
        {error && <p className="error-text">{error}</p>}

        {home && (
          <>
            <ConversationLink
              href={`/talk/${home.board.room_id}`}
              title="友達の掲示板"
              subtitle="友達へのお知らせを書いたり読んだりできます"
              conv={home.board}
              icon="📋"
              unreadWord="新しい書き込み"
            />

            <h2 className={styles.sectionTitle}>友達</h2>
            {home.friends.length === 0 ? (
              <p className={styles.empty}>
                まだ友達がいません。
                <br />
                下の「友達を増やす」に相手の方のお友達番号を入れると、追加できます。
              </p>
            ) : (
              <ul className={styles.list}>
                {home.friends.map((f) => (
                  <li key={f.user.id}>
                    <ConversationLink
                      href={`/talk/${f.room_id}`}
                      title={`${f.user.username}さん`}
                      note={sameNames.has(f.user.username) ? `${formatDateLabel(f.since)}に友達になった方` : undefined}
                      conv={f}
                      avatarName={f.user.username}
                      unreadWord="新しい連絡"
                    />
                  </li>
                ))}
              </ul>
            )}

            <AddFriendForm onFind={handleFind} onAdd={handleAdd} />
          </>
        )}
      </main>

      <footer className={styles.footer}>
        <button className="btn btn-outline" onClick={onSwitchUser}>
          別の方に代わる
        </button>
      </footer>
    </div>
  );
}

type LinkProps = {
  href: string;
  title: string;
  note?: string;
  subtitle?: string;
  conv: Conversation;
  unreadWord: string;
  avatarName?: string;
  icon?: string;
};

function ConversationLink({ href, title, note, subtitle, conv, unreadWord, avatarName, icon }: LinkProps) {
  const last = conv.last_message;
  const hasUnread = conv.unread > 0;
  return (
    <Link href={href} className={`${styles.row} ${hasUnread ? styles.rowUnread : ""}`}>
      <Avatar name={avatarName ?? title} icon={icon} />
      <span className={styles.rowBody}>
        <span className={styles.rowTop}>
          <span className={styles.rowTitle}>
            {title}
            {note && <span className={styles.rowNote}>{note}</span>}
          </span>
          {last && <span className={styles.when}>{formatWhen(last.created_at)}</span>}
        </span>
        {hasUnread && (
          <span className={styles.badges}>
            <span className={styles.badge}>
              {unreadWord} {conv.unread}件
            </span>
            {conv.mentions > 0 && <span className={styles.badgeMention}>あなた宛て {conv.mentions}件</span>}
          </span>
        )}
        <span className={styles.preview}>
          {last ? `${last.user.username}：${last.content}` : (subtitle ?? "まだ連絡はありません")}
        </span>
      </span>
      <span className={styles.chevron} aria-hidden>
        ›
      </span>
    </Link>
  );
}
