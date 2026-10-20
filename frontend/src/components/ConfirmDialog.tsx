"use client";

import { useEffect, useRef } from "react";

import styles from "./ConfirmDialog.module.css";

type Props = {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// 確認画面。間違えて押しても何も起きないよう「やめる」を先に置き、最初に選ばれた状態にする
export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog ref={ref} className={styles.dialog} onCancel={onCancel} aria-labelledby="confirm-message">
      <p id="confirm-message" className={styles.message}>
        {message}
      </p>
      <div className={styles.actions}>
        <button ref={cancelRef} className="btn btn-outline" onClick={onCancel}>
          やめる
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
