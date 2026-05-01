"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderAuthAction from "@/app/components/HeaderAuthAction";
import LogoutButton from "@/app/components/LogoutButton";
import MainNav from "@/app/components/MainNav";

function DashboardHeader({ role }: { role: "admin" | "doctor" }) {
  const title = role === "admin" ? "Admin Dashboard" : "Doctor Dashboard";
  const homeHref = role === "admin" ? "/admin/dashboard" : "/doctor/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${role === "admin" ? "bg-violet-500" : "bg-blue-500"}`} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Secure workspace</p>
            <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={homeHref} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Dashboard Home
          </Link>
          <HeaderAuthAction />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isAdmin = pathname.startsWith("/admin");
  const isDoctor = /^\/doctor(\/|$)/.test(pathname);

  if (isAdmin || isDoctor) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardHeader role={isAdmin ? "admin" : "doctor"} />
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Public nav */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.jpeg"
              alt="Telemedicine"
              className="h-8 w-auto object-contain"
            />
            <span className="sr-only">Telemedicine</span>
          </Link>

          <MainNav />

          <div className="flex items-center gap-3">
            <HeaderAuthAction />
          </div>
        </nav>
      </header>

      {children}

      {/* Footer */}
      <footer className="mt-20 bg-slate-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-3 md:px-8">
          <div>
            <div className="inline-flex items-center rounded-lg bg-white px-2 py-1">
              <img
                src="/logo.jpeg"
                alt="Telemedicine"
                className="h-6 w-auto object-contain"
              />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              Connected telemedicine for patients, doctors, and care teams. Secure, fast, and accessible.
            </p>
            <div className="mt-5 flex gap-3">
              <a href="#" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-white transition hover:bg-blue-600">f</a>
              <a href="#" aria-label="Twitter" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-white transition hover:bg-blue-600">t</a>
              <a href="#" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-white transition hover:bg-blue-600">in</a>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Useful Links</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li><Link href="/" className="transition hover:text-white">Home</Link></li>
              <li><Link href="/doctors" className="transition hover:text-white">Doctors</Link></li>
              <li><Link href="/appointments" className="transition hover:text-white">Appointments</Link></li>
              <li><Link href="/payments" className="transition hover:text-white">Payments</Link></li>
              <li><Link href="/symptoms" className="transition hover:text-white">Symptoms</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Address</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li>123 Fifth Ave, New York, NY</li>
              <li>+1 (800) 555-CARE</li>
              <li>care@telemedicine.example</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500 md:px-8">
          © {new Date().getFullYear()} All Rights Reserved
        </div>
      </footer>
    </div>
  );
}
