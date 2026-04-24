import type { Metadata } from "next";

import { NavBar } from "@/components/nav-bar";

import "./globals.css";

export const metadata: Metadata = {
  title: "OKI CRM",
  description: "Next.js + FastAPI + Supabase CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans text-slate-900 antialiased">
        <NavBar>{children}</NavBar>
      </body>
    </html>
  );
}
