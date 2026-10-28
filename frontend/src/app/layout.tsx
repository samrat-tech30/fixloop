import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";

import { Header } from "@/components/Header";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], weight: ["500"], variable: "--font-newsreader" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "FixLoop",
  description: "Paste a failed deploy log. Get the root cause and the fix.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-sx-page text-sx-ink">
        <Header />
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
