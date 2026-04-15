"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getConsultationToken } from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";

export default function TelemedicineJoinPage() {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = useMemo(() => decodeURIComponent(params?.appointmentId || ""), [params?.appointmentId]);
  const [message, setMessage] = useState("Preparing your consultation room...");
  const [error, setError] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function join() {
      if (!appointmentId) {
        if (!alive) return;
        setError("Missing appointment ID in the join link.");
        setMessage("Unable to open consultation room.");
        return;
      }

      try {
        const auth = getFirebaseAuth();
        const user = await new Promise<import("firebase/auth").User | null>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (u) => {
            unsubscribe();
            resolve(u);
          });
        });

        if (!user) {
          if (!alive) return;
          setError("Please sign in first, then open this link again.");
          setMessage("Authentication required.");
          return;
        }

        const token = await user.getIdToken();
        const joinToken = await getConsultationToken(appointmentId, token);
        const url = `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(joinToken.wsUrl)}&token=${encodeURIComponent(joinToken.token)}`;

        if (!alive) return;
        setJoinUrl(url);
        setMessage("Room ready. Redirecting...");

        window.location.href = url;
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to open consultation room.");
        setMessage("Could not join consultation.");
      }
    }

    void join();

    return () => {
      alive = false;
    };
  }, [appointmentId]);

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Telemedicine</p>
        <h1 className="section-title">Join consultation</h1>
        <p className="section-subtitle">Appointment: {appointmentId || "Unknown"}</p>
      </section>

      <section className="surface-card text-sm">
        <p><strong>Status:</strong> {message}</p>
        {error && <p className="mt-3 text-red-700"><strong>Error:</strong> {error}</p>}
        {!error && joinUrl && (
          <p className="mt-3 text-blue-700 break-all">
            If redirect did not start, use this link: <a href={joinUrl} target="_blank" rel="noreferrer">Open consultation room</a>
          </p>
        )}
      </section>

      <div className="flex gap-3">
        <Link href="/appointments" className="btn-secondary">Back to appointments</Link>
      </div>
    </main>
  );
}
