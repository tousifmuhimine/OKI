import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "OKKI CRM — B2B Foreign Trade Platform",
  description: "Premium B2B foreign trade CRM built with Next.js and FastAPI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <NavBar>{children}</NavBar>
        </ThemeProvider>
      </body>
    </html>
  );
}
