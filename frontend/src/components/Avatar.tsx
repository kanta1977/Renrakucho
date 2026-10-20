import { avatarColor } from "@/lib/format";

export function Avatar({ name, size = 56, icon }: { name: string; size?: number; icon?: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: icon ? "var(--primary)" : avatarColor(name),
        color: "#fff",
        display: "inline-grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {icon ?? [...name][0]}
    </span>
  );
}
