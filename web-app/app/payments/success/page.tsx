"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { verifyPayment } from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";

function PaymentSuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || "";

  const [message, setMessage] = useState("Verifying payment...");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runVerification() {
      if (!sessionId) {
        setError("Missing payment reference in URL");
        setMessage("Verification could not start.");
        return;
      }

        try {
          const auth = getFirebaseAuth();
          // Wait for Firebase Auth to initialize before checking sign-in state.
          const user = await new Promise<import("firebase/auth").User | null>((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (u) => {
              unsubscribe();
              resolve(u);
            });
          });
          if (!user) {
            setError("Please sign in to verify your payment.");
            setMessage("Verification requires authentication.");
            return;
          }
          const idToken = await user.getIdToken();

          const result = await verifyPayment(sessionId, idToken);
          setMessage(result.message || "Payment verified");
          setStatus(result.status);

          // NOTE: /payments/verify already triggers internal appointment confirmation
          // in payment-service (notifyAppointmentPaymentConfirmed). Do not call
          // /appointments/:id/confirm-payment again here, otherwise the second call
          // may return "not applicable ... status CONFIRMED" and look like a false error.
          if (result.status === "COMPLETED") {
            setMessage((prev) => (prev ? prev + " — appointment confirmation synced." : "Appointment confirmation synced."));
          }
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
