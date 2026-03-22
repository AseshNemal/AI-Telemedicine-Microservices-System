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
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Payment Success</h1>
      <p className="text-sm text-neutral-600">Stripe redirected you back. We are now confirming payment status.</p>

      <section className="rounded border p-4 text-sm">
        <p><strong>Session ID:</strong> {sessionId || "N/A"}</p>
        <p className="mt-2"><strong>Message:</strong> {message}</p>
        {status && <p className="mt-2"><strong>Internal Status:</strong> {status}</p>}
        {error && <p className="mt-2 text-red-700"><strong>Error:</strong> {error}</p>}
      </section>

      <div className="flex gap-3">
        <Link href="/payments" className="rounded bg-black px-4 py-2 text-sm text-white">Back to Payments</Link>
        <Link href="/appointments" className="rounded border px-4 py-2 text-sm">Appointments</Link>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-6 text-sm">Loading payment verification...</main>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
