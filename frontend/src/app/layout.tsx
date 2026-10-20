import type { Metadata, Viewport } from "next";

import { AuthProvider } from "@/hooks/useAuth";
import { EventsProvider } from "@/hooks/useEvents";

import "./globals.css";

export const metadata: Metadata = {
  title: "れんらく帳",
  description: "家族や友達と、大きな文字でかんたんに連絡できる帳面",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b7a35",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          <EventsProvider>{children}</EventsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
