import type { Metadata } from "next";
import { Barrio, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barrio = Barrio({
  variable: "--font-barrio",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "DTV",
  description: "A looping television-channel concept built around Duncan Trussell story playback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barrio.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#120f1d] text-[#f4efe7]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
