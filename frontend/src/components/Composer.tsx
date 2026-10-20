"use client";

import { useRef, useState } from "react";

import { MESSAGE_MAX_LENGTH } from "@/lib/config";
import type { User } from "@/lib/types";

import styles from "./Composer.module.css";

type Props = {
  onSend: (content: string, mentionUserId: number | null) => Promise<void>;
  placeholder: string;
  // 掲示板のときだけ渡す（宛先の候補）
  recipients?: User[];
};

// 送信は「送る」ボタンだけ。Enter は改行（日本語の変換確定で送られないように）
export function Composer({ onSend, placeholder, recipients }: Props) {
  const [text, setText] = useState("");
  const [to, setTo] = useState(""); // "" は「友達みんなへ」
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const tooLong = trimmed.length > MESSAGE_MAX_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || tooLong || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(trimmed, to ? Number(to) : null);
      setText("");
      setTo("");
    } catch (err) {
      // 失敗しても書いた文は消さない
      setError((err as Error).message);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  }

  return (
    <form className={styles.bar} onSubmit={submit}>
      <div className={styles.inner}>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {tooLong && <p className="error-text">長すぎます（{MESSAGE_MAX_LENGTH}文字まで）</p>}
        {recipients && (
          <div className={styles.toRow}>
            <label htmlFor="composer-to" className={styles.toLabel}>
              宛先
            </label>
            <select id="composer-to" className={`field ${styles.toSelect}`} value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">友達みんなへ</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.username}さんへ
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={styles.row}>
          <label htmlFor="composer" className="visually-hidden">
            連絡を書く
          </label>
          <textarea
            id="composer"
            ref={ref}
            className={`field ${styles.input}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={2}
          />
          <button className={`btn btn-primary ${styles.send}`} type="submit" disabled={!trimmed || tooLong || sending}>
            {sending ? "送っています" : "送る"}
          </button>
        </div>
      </div>
    </form>
  );
}
