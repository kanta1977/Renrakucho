"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HomeScreen } from "@/components/HomeScreen";
import { useAuth } from "@/hooks/useAuth";
import { formatCode } from "@/lib/format";

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/start");
  }, [auth.status, router]);

  if (auth.status !== "authenticated") return null;

  return (
    <>
      <HomeScreen token={auth.token} onSwitchUser={() => setConfirmSwitch(true)} onAuthError={auth.logout} />
      {confirmSwitch && (
        <ConfirmDialog
          message={`別の方に代わりますか？\n「前にも使った」から、番号 ${formatCode(auth.user.friend_code)} とパスワードを入れれば、いつでも戻れます。`}
          confirmLabel="代わる"
          onConfirm={auth.logout}
          onCancel={() => setConfirmSwitch(false)}
        />
      )}
    </>
  );
}
