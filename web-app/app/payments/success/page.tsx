"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyPayment } from "@/app/lib/api";

function PaymentSuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || "";

  const [message, setMessage] = useState("Verifying payment...");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runVerification() {
      if (!sessionId) {
        setError("Missing session_id in URL");
        setMessage("Verification could not start.");
        return;
      }

      try {
        const result = await verifyPayment(sessionId);
        setMessage(result.message || "Payment verified");
        setStatus(result.status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment verification failed");
        setMessage("Verification failed.");
      }
    }

    runVerification();
  }, [sessionId]);

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Checkout Result</p>
        <h1 className="section-title">Payment Success</h1>
        <p className="section-subtitle">Stripe redirected you back. We are now confirming payment status.</p>
      </section>

      <section className="surface-card text-sm">
        <p><strong>Session ID:</strong> {sessionId || "N/A"}</p>
        <p className="mt-2"><strong>Message:</strong> {message}</p>
        {status && <p className="mt-2"><strong>Internal Status:</strong> {status}</p>}
        {error && <p className="mt-2 text-red-700"><strong>Error:</strong> {error}</p>}
      </section>

      <div className="flex gap-3">
        <Link href="/payments" className="btn-primary">Back to Payments</Link>
        <Link href="/appointments" className="btn-secondary">Appointments</Link>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<main className="page-shell text-sm">Loading payment verification...</main>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
