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
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Telemedicine
            </Link>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-sm">
              <Link href="/auth" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Auth</Link>
              <Link href="/doctors" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Doctors</Link>
              <Link href="/appointments" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Appointments</Link>
              <Link href="/payments" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Payments</Link>
              <Link href="/symptoms" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Symptoms</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
