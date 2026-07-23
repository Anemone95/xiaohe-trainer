import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小鹤双拼练习",
  description: "随机练习小鹤双拼声母和韵母键位，并按记忆曲线复习错题。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
