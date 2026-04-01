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
        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="border-b border-slate-200/70 bg-slate-50/80">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-slate-600 md:px-8">
                <p className="uppercase tracking-[0.16em]">Virtual care network</p>
                <p>
                  Need immediate support? <span className="font-semibold text-slate-800">+1 (800) 555-CARE</span>
                </p>
              </div>
            </div>

            <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
              <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Telemedicine
              </Link>
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-sm">
                <Link href="/auth" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Access</Link>
                <Link href="/patient/profile" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Profile</Link>
                <Link href="/doctors" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Doctors</Link>
                <Link href="/appointments" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Appointments</Link>
                <Link href="/payments" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Payments</Link>
                <Link href="/symptoms" className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Symptoms</Link>
              </div>
              <Link href="/symptoms" className="btn-primary text-xs md:text-sm">
                Check Symptoms
              </Link>
            </nav>
          </header>

          {children}

          <footer className="mt-14 border-t border-slate-200 bg-white/70">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] md:px-8">
              <div>
                <p className="section-kicker">Need help?</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">We are here to support your care journey.</h2>
                <p className="mt-3 text-sm text-slate-600">
                  Connect with clinicians, manage appointments, and stay informed with secure digital care tools.
                </p>
              </div>

              <div className="text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick links</p>
                <ul className="mt-3 space-y-2">
                  <li><Link href="/" className="hover:text-slate-900">Home</Link></li>
                  <li><Link href="/doctors" className="hover:text-slate-900">Doctors</Link></li>
                  <li><Link href="/appointments" className="hover:text-slate-900">Appointments</Link></li>
                  <li><Link href="/payments" className="hover:text-slate-900">Payments</Link></li>
                  <li><Link href="/symptoms" className="hover:text-slate-900">Symptoms</Link></li>
                </ul>
              </div>

              <div className="text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resources</p>
                <ul className="mt-3 space-y-2">
                  <li>Telemedicine onboarding</li>
                  <li>Virtual visit preparation</li>
                  <li>Care continuity guidance</li>
                  <li>Billing and payment support</li>
                </ul>
              </div>

              <div className="text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contact</p>
                <ul className="mt-3 space-y-2">
                  <li>123 Fifth Ave, New York, NY</li>
                  <li>+1 (800) 555-CARE</li>
                  <li>care@telemedicine.example</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-200/80 px-4 py-4 text-center text-xs text-slate-500 md:px-8">
              © {new Date().getFullYear()} Telemedicine Care Platform. All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
