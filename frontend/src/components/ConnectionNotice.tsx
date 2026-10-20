"use client";

import { useConnectionStatus } from "@/hooks/useEvents";

// 接続が切れたときだけ表示する
export function ConnectionNotice() {
  const status = useConnectionStatus();
  if (status === "open" || status === "connecting") return null;
  return (
    <p
      role="status"
      style={{
        background: "var(--notice-soft)",
        color: "var(--notice)",
        fontWeight: 700,
        padding: "10px 16px",
        textAlign: "center",
      }}
    >
      つながりが切れました。つなぎ直しています…
    </p>
  );
}
