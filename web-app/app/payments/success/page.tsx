"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyPayment, confirmAppointmentPayment } from "@/app/lib/api";
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
        setError("Missing session_id in URL");
        setMessage("Verification could not start.");
        return;
      }

        try {
          const result = await verifyPayment(sessionId);
          setMessage(result.message || "Payment verified");
          setStatus(result.status);

          // If payment is completed and we have an appointmentId, attempt to
          // auto-confirm the appointment so the UI updates and payment buttons
          // are removed without requiring a manual "I have paid" click.
          if (result.status === "COMPLETED") {
            const maybe = result as unknown as { appointmentId?: string };
            if (maybe.appointmentId) {
              const appointmentId = maybe.appointmentId as string;
              try {
                const auth = getFirebaseAuth();
                const user = auth.currentUser;
                if (user) {
                  const idToken = await user.getIdToken();
                  await confirmAppointmentPayment(appointmentId, idToken);
                  setMessage((prev) => (prev ? prev + " — appointment confirmed." : "Appointment confirmed."));
                } else {
                  setMessage((prev) => (prev ? prev + " — please sign in to finalize appointment confirmation." : "Please sign in to finalize appointment confirmation."));
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to auto-confirm appointment");
              }
            }
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
