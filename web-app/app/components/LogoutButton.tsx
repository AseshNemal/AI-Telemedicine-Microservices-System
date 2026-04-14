"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(Boolean(user));
    });

    return () => unsubscribe();
  }, []);

  async function handleLogout() {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch {
      // best-effort sign out; ignore errors
    } finally {
      setLoading(false);
      router.push("/auth");
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
