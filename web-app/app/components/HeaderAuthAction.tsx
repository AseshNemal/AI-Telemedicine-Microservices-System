"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import { getDashboardPathForRole } from "@/app/lib/roleRouting";

function getDisplayName(user: User) {
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Patient";
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "P";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export default function HeaderAuthAction() {
  const [user, setUser] = useState<User | null>(null);
  const [profilePath, setProfilePath] = useState("/patient/profile");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfilePath("/auth");
        return;
      }

      try {
        const token = await currentUser.getIdTokenResult();
        const role = String(token.claims.role || "PATIENT");
        setProfilePath(getDashboardPathForRole(role));
      } catch {
        setProfilePath("/patient/profile");
      }
    });

    return () => unsubscribe();
  }, []);

  const displayName = useMemo(() => (user ? getDisplayName(user) : ""), [user]);

  if (!user) {
    return (
      <Link href="/auth" className="btn-primary text-xs md:text-sm">
        Login
      </Link>
    );
  }

  return (
    <Link
      href={profilePath}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 md:text-sm"
      title={displayName}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
        {getInitials(displayName)}
      </span>
      <span className="max-w-[120px] truncate">{displayName}</span>
    </Link>
  );
}
