// 日付と時刻の表示（例: 午後3:05、10月17日（土））

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "numeric", minute: "2-digit", hour12: true });
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function isSameDay(a: string, b: string): boolean {
  return sameDay(new Date(a), new Date(b));
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, new Date())) return "今日";
  if (sameDay(d, yesterday)) return "昨日";
  return d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
}

// 今日なら時刻、それ以外は日付
export function formatWhen(iso: string): string {
  const label = formatDateLabel(iso);
  return label === "今日" ? formatTime(iso) : label;
}

export function avatarColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return `hsl(${h} 45% 42%)`;
}

// "482915" → "482-915"
export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

// 数字だけ取り出す（全角も可）
export function digitsOnly(input: string): string {
  return input.normalize("NFKC").replace(/\D/g, "");
}

// パスワードのルール（バックエンドと同じ）
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "8文字以上にしてください";
  if (pw.length > 64) return "64文字以内にしてください";
  if (!/^[\x21-\x7e]+$/.test(pw)) return "半角の英字・数字・記号だけで入れてください（空白は使えません）";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "英字と数字を両方まぜてください";
  return null;
}
