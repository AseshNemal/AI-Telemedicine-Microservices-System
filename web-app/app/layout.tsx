import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "AI Telemedicine Microservices System",
  description: "Distributed telemedicine starter using Go microservices and Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b bg-white/70 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between p-4 text-sm">
            <Link href="/" className="font-semibold">Telemedicine</Link>
            <div className="flex gap-4">
              <Link href="/auth">Auth</Link>
              <Link href="/doctors">Doctors</Link>
              <Link href="/appointments">Appointments</Link>
              <Link href="/payments">Payments</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
