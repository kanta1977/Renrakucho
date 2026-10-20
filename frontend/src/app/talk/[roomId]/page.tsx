"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { TalkScreen } from "@/components/TalkScreen";
import { useAuth } from "@/hooks/useAuth";

export default function TalkPage() {
  const auth = useAuth();
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const id = Number(roomId);

  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/start");
    else if (!Number.isInteger(id) || id < 1) router.replace("/");
  }, [auth.status, id, router]);

  if (auth.status !== "authenticated" || !Number.isInteger(id)) return null;
  return <TalkScreen key={id} roomId={id} me={auth.user} token={auth.token} />;
}
