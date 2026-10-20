"use client";

import { useState } from "react";

import { FRIEND_CODE_DIGITS, PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH } from "@/lib/config";
import { digitsOnly, formatCode, passwordProblem } from "@/lib/format";
import type { LoginResponse } from "@/lib/types";

import styles from "./StartScreen.module.css";

type Props = {
  register: (name: string, password: string) => Promise<LoginResponse>;
  signIn: (res: LoginResponse) => void;
  resume: (code: string, password: string) => Promise<void>;
};

type Mode = "choose" | "new" | "issued" | "return";

// 入口。「はじめて使う」と「前にも使った」の2つに分けている
export function StartScreen({ register, signIn, resume }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [issued, setIssued] = useState<LoginResponse | null>(null);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>れんらく帳</h1>

        {mode === "choose" && (
          <>
            <p className={styles.lead}>家族や友達と、連絡を取り合うための帳面です。</p>
            <button className={`btn btn-primary ${styles.door}`} onClick={() => setMode("new")}>
              はじめて使う
              <span className={styles.doorSub}>お名前を入れると、あなたの番号ができます</span>
            </button>
            <button className={`btn btn-outline ${styles.door}`} onClick={() => setMode("return")}>
              前にも使った
              <span className={styles.doorSub}>お友達番号とパスワードで入ります</span>
            </button>
          </>
        )}

        {mode === "new" && (
          <NewForm
            onBack={() => setMode("choose")}
            onDone={async (name, password) => {
              setIssued(await register(name, password));
              setMode("issued");
            }}
          />
        )}

        {mode === "issued" && issued && (
          <div className={styles.issued}>
            <p className={styles.lead}>
              {issued.user.username}さんの
              <br />
              お友達番号ができました
            </p>
            <p className={styles.code} aria-label={`お友達番号 ${issued.user.friend_code.split("").join(" ")}`}>
              {formatCode(issued.user.friend_code)}
            </p>
            <ul className={styles.notes}>
              <li>この番号を、紙などに書きとめてください。</li>
              <li>友達にこの番号を教えると、友達になれます。</li>
              <li>次に入るときは、この番号と、決めたパスワードを使います。</li>
            </ul>
            <p className={styles.lead}>書きとめたら「はじめる」を押してください。</p>
            <button className={`btn btn-primary ${styles.submit}`} onClick={() => signIn(issued)}>
              はじめる
            </button>
          </div>
        )}

        {mode === "return" && <ReturnForm onBack={() => setMode("choose")} onDone={resume} />}
      </div>
    </main>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={`btn btn-outline ${styles.back}`} onClick={onClick}>
      ← もどる
    </button>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  shown,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  shown: boolean;
  autoComplete: string;
}) {
  return (
    <>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className="field"
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        maxLength={64}
      />
    </>
  );
}

function ShowToggle({ shown, onChange }: { shown: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.show}>
      <input type="checkbox" checked={shown} onChange={(e) => onChange(e.target.checked)} />
      入れた文字を表示する
    </label>
  );
}

function NewForm({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: (name: string, password: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return setError("お名前を入れてください");
    const problem = passwordProblem(password);
    if (problem) return setError(`パスワード：${problem}`);
    if (password !== password2) return setError("確認用のパスワードが一致しません");
    setBusy(true);
    setError(null);
    try {
      await onDone(trimmed, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <BackLink onClick={onBack} />
      <label htmlFor="name" className={styles.label}>
        あなたのお名前
      </label>
      <input
        id="name"
        className="field"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        placeholder="例：山本 静子"
        maxLength={USERNAME_MAX_LENGTH}
        autoComplete="name"
        autoFocus
        aria-describedby="name-help"
      />
      <p id="name-help" className={styles.help}>
        友達の画面に出るお名前です。同じお名前の方がいても大丈夫です。
      </p>

      <div className={styles.gap} />
      <PasswordField
        id="password"
        label="パスワードを決める"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError(null);
        }}
        shown={shown}
        autoComplete="new-password"
      />
      <p className={styles.help}>
        半角の<strong>英字と数字を両方</strong>まぜて、{PASSWORD_MIN_LENGTH}文字以上（例：sizuko1950）
      </p>
      <div className={styles.gap} />
      <PasswordField
        id="password2"
        label="もう一度、同じパスワード"
        value={password2}
        onChange={(v) => {
          setPassword2(v);
          setError(null);
        }}
        shown={shown}
        autoComplete="new-password"
      />
      <ShowToggle shown={shown} onChange={setShown} />

      <p className={`error-text ${styles.error}`} role="alert">
        {error}
      </p>
      <button className={`btn btn-primary ${styles.submit}`} type="submit" disabled={busy}>
        {busy ? "準備しています…" : "次へ"}
      </button>
    </form>
  );
}

function ReturnForm({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: (code: string, password: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = digitsOnly(code);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (digits.length !== FRIEND_CODE_DIGITS) return setError(`番号は${FRIEND_CODE_DIGITS}けたの数字です`);
    if (!password) return setError("パスワードを入れてください");
    setBusy(true);
    setError(null);
    try {
      await onDone(digits, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <BackLink onClick={onBack} />
      <label htmlFor="code" className={styles.label}>
        あなたのお友達番号（{FRIEND_CODE_DIGITS}けた）
      </label>
      <input
        id="code"
        className={`field ${styles.codeInput}`}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        placeholder="例：482-915"
        inputMode="numeric"
        autoComplete="off"
        maxLength={FRIEND_CODE_DIGITS + 4}
        autoFocus
      />
      <div className={styles.gap} />
      <PasswordField
        id="password"
        label="パスワード"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError(null);
        }}
        shown={shown}
        autoComplete="current-password"
      />
      <ShowToggle shown={shown} onChange={setShown} />
      <p className={`error-text ${styles.error}`} role="alert">
        {error}
      </p>
      <button className={`btn btn-primary ${styles.submit}`} type="submit" disabled={busy}>
        {busy ? "入っています…" : "入る"}
      </button>
    </form>
  );
}
