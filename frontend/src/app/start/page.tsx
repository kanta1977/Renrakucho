"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { StartScreen } from "@/components/StartScreen";
import { useAuth } from "@/hooks/useAuth";

export default function StartPage() {
  const { status, register, signIn, resume } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status !== "anonymous") return null;
  return <StartScreen register={register} signIn={signIn} resume={resume} />;
}
