"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useServerEvents } from "@/hooks/useEvents";
import { useTalk } from "@/hooks/useTalk";
import { api, ApiError } from "@/lib/api";
import type { Room, User } from "@/lib/types";

import { Composer } from "./Composer";
import { ConfirmDialog } from "./ConfirmDialog";
import { ConnectionNotice } from "./ConnectionNotice";
import { MessageList } from "./MessageList";
import styles from "./TalkScreen.module.css";

type Props = { roomId: number; me: User; token: string };

// やり取りの画面（一対一と掲示板で共通）
export function TalkScreen({ roomId, me, token }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const talk = useTalk(roomId, token);

  useEffect(() => {
    api
      .getRoom(token, roomId)
      .then(setRoom)
      .catch((e: ApiError) => setRoomError(e.message));
  }, [token, roomId]);

  // 掲示板の宛先に出す友達一覧
  const loadFriends = useCallback(() => {
    api
      .home(token)
      .then((h) => setFriends(h.friends.map((f) => f.user)))
      .catch(() => {});
  }, [token]);
  useEffect(() => {
    if (room?.kind === "board") loadFriends();
  }, [room?.kind, loadFriends]);
  useServerEvents((e) => {
    if (e.type === "friends.changed" && room?.kind === "board") loadFriends();
  });

  async function removeFriend() {
    if (!room?.friend) return;
    await api.removeFriend(token, room.friend.id).catch(() => {});
    router.replace("/");
  }

  const isBoard = room?.kind === "board";
  const title = room ? (isBoard ? room.title : `${room.title}さん`) : "";

  return (
    <div className={styles.page}>
      <ConnectionNotice />
      <header className={styles.header}>
        <Link href="/" className={`btn ${styles.back}`}>
          ← もどる
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {room?.friend && (
          <button className={`btn btn-outline ${styles.remove}`} onClick={() => setConfirmRemove(true)}>
            友達から外す
          </button>
        )}
      </header>

      {roomError ? (
        <div className={styles.center}>
          <p className="error-text">{roomError}</p>
          <Link href="/" className="btn btn-primary">
            はじめの画面へもどる
          </Link>
        </div>
      ) : (
        <>
          {isBoard && (
            <p className={styles.boardNote}>
              ここに書いたことは、<strong>あなたの友達全員</strong>が読めます。友達ではない方には見えません。
            </p>
          )}
          <MessageList
            messages={talk.messages}
            myId={me.id}
            showNames={isBoard}
            loading={talk.loading}
            hasMore={talk.hasMore}
            loadingOlder={talk.loadingOlder}
            onLoadOlder={talk.loadOlder}
          />
          <Composer
            onSend={talk.send}
            placeholder={isBoard ? "友達へのお知らせを書く" : room ? `${room.title}さんへの連絡を書く` : ""}
            recipients={isBoard ? friends : undefined}
          />
        </>
      )}

      {confirmRemove && room?.friend && (
        <ConfirmDialog
          message={`${room.friend.username}さんを友達から外しますか？\nお互いの友達一覧から消え、連絡できなくなります。`}
          confirmLabel="外す"
          onConfirm={removeFriend}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
