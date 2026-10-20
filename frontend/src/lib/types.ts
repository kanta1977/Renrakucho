// backend/app/schemas.py と同じ形

// 他の人（番号は含まない）
export type User = {
  id: number;
  username: string;
};

// 自分（自分の番号を含む）
export type Me = User & { friend_code: string };

export type LoginResponse = {
  token: string;
  user: Me;
};

export type Message = {
  id: number;
  room_id: number;
  user: User;
  content: string;
  mention: User | null; // 掲示板の宛先
  created_at: string;
};

export type MessagePage = {
  items: Message[]; // 古い順
  has_more: boolean;
};

export type Conversation = {
  room_id: number;
  unread: number;
  mentions: number; // 自分宛ての未読数
  last_message: Message | null;
};

export type Friend = Conversation & { user: User; since: string };

export type Home = {
  me: Me;
  board: Conversation;
  friends: Friend[];
};

export type Room = {
  id: number;
  kind: "board" | "direct";
  title: string;
  friend: User | null;
};

// WebSocket で届く知らせ。"reconnected" はつなぎ直したときに画面側で出すもの
export type ServerEvent =
  | { type: "message.created"; data: Message }
  | { type: "friends.changed" }
  | { type: "reconnected" };
