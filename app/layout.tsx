import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hadir — Attendance, made clear",
  description: "Manage your team, track attendance, and keep every workday in view.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
