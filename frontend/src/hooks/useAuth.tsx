"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { LoginResponse, Me } from "@/lib/types";

const TOKEN_KEY = "renrakucho.token";

type AuthState =
  | { status: "loading"; user: null; token: null }
  | { status: "anonymous"; user: null; token: null }
  | { status: "authenticated"; user: Me; token: string };

type AuthContextValue = AuthState & {
  // はじめて使う。番号を表示してから入るので、ここではまだログインしない
  register: (username: string, password: string) => Promise<LoginResponse>;
  // 番号を表示したあとに呼ぶ
  signIn: (res: LoginResponse) => void;
  // 前にも使った
  resume: (friendCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ANON: AuthState = { status: "anonymous", user: null, token: null };

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 保存できない環境では、再読み込みまでの間だけログイン状態を保つ */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, token: null });

  // 再読み込みしてもログイン状態を保つ
  useEffect(() => {
    const token = readToken();
    if (!token) {
      setState(ANON);
      return;
    }
    api
      .me(token)
      .then((user) => setState({ status: "authenticated", user, token }))
      .catch(() => {
        writeToken(null);
        setState(ANON);
      });
  }, []);

  const signIn = useCallback(({ token, user }: LoginResponse) => {
    writeToken(token);
    setState({ status: "authenticated", user, token });
  }, []);

  const register = useCallback((username: string, password: string) => api.register(username, password), []);

  const resume = useCallback(
    async (friendCode: string, password: string) => {
      signIn(await api.resume(friendCode, password));
    },
    [signIn],
  );

  const logout = useCallback(async () => {
    const token = readToken();
    writeToken(null);
    setState(ANON);
    if (token) await api.logout(token).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ ...state, register, signIn, resume, logout }),
    [state, register, signIn, resume, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
