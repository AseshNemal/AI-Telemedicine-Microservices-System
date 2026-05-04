'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/app/components/LogoutButton';

const navItems = [
  { href: '/appointments', label: 'Appointments' },
  { href: '/doctors', label: 'Doctor List' },
  { href: '/symptoms', label: 'Symptoms' },
  { href: '/telemedicine', label: 'Telemedicine' },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MainNav() {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-7 text-sm font-medium md:flex">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`transition ${
              active
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <LogoutButton />
    </div>
  );
}
