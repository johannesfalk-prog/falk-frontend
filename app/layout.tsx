import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FALK — En kompass med perspektiv",
  description: "Wayjs digitala mentor och operativsystem för mänsklig utveckling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[#E8DCC4] text-[#1C1C1C]`}
    >
      <body className="min-h-full flex flex-col bg-[#E8DCC4] text-[#1C1C1C]">
        {children}
      </body>
    </html>
  );
}
