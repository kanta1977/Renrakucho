export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL ?? API_BASE_URL.replace(/^http/, "ws");

export const MESSAGE_MAX_LENGTH = 1000;
export const USERNAME_MAX_LENGTH = 20;
export const FRIEND_CODE_DIGITS = 6;
export const PASSWORD_MIN_LENGTH = 8;
