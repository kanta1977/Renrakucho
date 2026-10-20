// バックエンドとの通信。認証ヘッダーとエラー処理は request にまとめている

import { API_BASE_URL } from "./config";
import type { Home, LoginResponse, Me, Message, MessagePage, Room, User } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, "つながりませんでした。少し待ってから、もう一度お試しください");
  }

  if (!res.ok) {
    // サーバーのエラー文言はそのまま出す。422（入力チェック）だけは英語なので置き換える
    let detail = "うまくいきませんでした。もう一度お試しください";
    if (res.status === 422) detail = "入力した内容を、もう一度お確かめください";
    else {
      try {
        const body = await res.json();
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        /* JSON でない返事 */
      }
    }
    throw new ApiError(res.status, detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<LoginResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),

  resume: (friendCode: string, password: string) =>
    request<LoginResponse>("/api/auth/resume", {
      method: "POST",
      body: JSON.stringify({ friend_code: friendCode, password }),
    }),

  me: (token: string) => request<Me>("/api/auth/me", { token }),

  logout: (token: string) => request<void>("/api/auth/logout", { method: "POST", token }),

  home: (token: string) => request<Home>("/api/home", { token }),

  findByCode: (token: string, friendCode: string) =>
    request<User>(`/api/users/by-code/${encodeURIComponent(friendCode)}`, { token }),

  addFriend: (token: string, friendCode: string) =>
    request<User>("/api/friends", { method: "POST", token, body: JSON.stringify({ friend_code: friendCode }) }),

  removeFriend: (token: string, friendId: number) =>
    request<void>(`/api/friends/${friendId}`, { method: "DELETE", token }),

  getRoom: (token: string, roomId: number) => request<Room>(`/api/rooms/${roomId}`, { token }),

  listMessages: (token: string, roomId: number, beforeId?: number) =>
    request<MessagePage>(`/api/rooms/${roomId}/messages${beforeId ? `?before_id=${beforeId}` : ""}`, { token }),

  sendMessage: (token: string, roomId: number, content: string, mentionUserId?: number | null) =>
    request<Message>(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      token,
      body: JSON.stringify({ content, mention_user_id: mentionUserId ?? null }),
    }),

  markRead: (token: string, roomId: number) =>
    request<void>(`/api/rooms/${roomId}/read`, { method: "POST", token }),
};
