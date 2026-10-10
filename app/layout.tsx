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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('hadir-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}` }} />{children}</body>
    </html>
  );
}
