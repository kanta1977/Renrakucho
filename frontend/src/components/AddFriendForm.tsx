"use client";

import { useState } from "react";

import { FRIEND_CODE_DIGITS } from "@/lib/config";
import { digitsOnly, formatCode } from "@/lib/format";
import type { User } from "@/lib/types";

import styles from "./HomeScreen.module.css";

type Props = {
  onFind: (code: string) => Promise<User>;
  onAdd: (code: string) => Promise<void>;
};

// 友達の追加。番号で探して名前を確認してから追加する（打ち間違い対策）
export function AddFriendForm({ onFind, onAdd }: Props) {
  const [code, setCode] = useState("");
  // サーバーは番号を返さないので、入力した番号を一緒に持っておく
  const [found, setFound] = useState<{ user: User; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const digits = digitsOnly(code);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (digits.length !== FRIEND_CODE_DIGITS) {
      setResult({ ok: false, text: `番号は${FRIEND_CODE_DIGITS}けたの数字です` });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setFound({ user: await onFind(digits), code: digits });
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!found) return;
    setBusy(true);
    try {
      await onAdd(found.code);
      setResult({ ok: true, text: `${found.user.username}さんを友達に追加しました` });
      setCode("");
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setFound(null);
      setBusy(false);
    }
  }

  return (
    <section className={styles.addBox} aria-labelledby="add-title">
      <h2 id="add-title" className={styles.sectionTitle}>
        友達を増やす
      </h2>

      {found ? (
        <div className={styles.found} role="status">
          <p className={styles.foundName}>
            {found.user.username}さん
            <span className={styles.foundCode}>（{formatCode(found.code)}）</span>
          </p>
          <p>この方を友達に追加しますか？</p>
          <div className={styles.foundActions}>
            <button className="btn btn-outline" onClick={() => setFound(null)} disabled={busy}>
              やめる
            </button>
            <button className="btn btn-primary" onClick={add} disabled={busy}>
              追加する
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.addHelp}>相手の方の「お友達番号」（{FRIEND_CODE_DIGITS}けた）を入れてください。</p>
          <form className={styles.addForm} onSubmit={find}>
            <label htmlFor="friend-code" className="visually-hidden">
              友達のお友達番号
            </label>
            <input
              id="friend-code"
              className={`field ${styles.codeField}`}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setResult(null);
              }}
              placeholder="例：482-915"
              inputMode="numeric"
              autoComplete="off"
              maxLength={FRIEND_CODE_DIGITS + 4}
            />
            <button className="btn btn-primary" type="submit" disabled={!digits || busy}>
              {busy ? "さがしています…" : "さがす"}
            </button>
          </form>
        </>
      )}

      {result && (
        <p role="status" className={result.ok ? styles.addOk : "error-text"} style={{ marginTop: 10 }}>
          {result.text}
        </p>
      )}
    </section>
  );
}
