import type { Metadata } from "next";
import "./globals.css";
import AppearanceProvider from './appearance-provider';
import { appearanceBootstrap } from '@/lib/appearance';

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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><script id="hadir-appearance-bootstrap" dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /><AppearanceProvider>{children}</AppearanceProvider></body>
    </html>
  );
}
