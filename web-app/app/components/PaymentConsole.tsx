"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import { createPayment } from "@/app/lib/api";

export default function PaymentConsole() {
  const [appointmentId, setAppointmentId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!idToken) {
      setError("Please sign in to create a payment.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const payment = await createPayment({
        appointmentId,
        patientId,
        doctorId,
        amount: Number(amount),
        currency,
        paymentMethod: "CARD",
      }, idToken);

      if (!payment.checkoutUrl) {
        throw new Error("Checkout URL not returned from payment service");
      }

      if (!payment.checkoutUrl.startsWith("https://checkout.stripe.com/")) {
        throw new Error("Invalid checkout URL received");
      }

      window.location.href = payment.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={onSubmit} className="surface-card">
        <p className="section-kicker">Start checkout</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Create a payment session</h2>
        <p className="mt-2 text-sm text-slate-600">Enter consultation details and continue to secure Stripe checkout.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            className="field-input"
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
            placeholder="Appointment ID (e.g. APT-9081)"
            required
          />
          <input
            className="field-input"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Patient ID (e.g. PAT-1203)"
            required
          />
          <input
            className="field-input"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            placeholder="Doctor ID (e.g. DOC-0042)"
            required
          />
          <input
            type="number"
            min="1"
            step="0.01"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            required
          />

          <select
            className="field-input md:col-span-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            required
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="LKR">LKR</option>
          </select>

          <button
            className="btn-primary md:col-span-2"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating payment..." : "Continue to secure checkout"}
          </button>
        </div>
      </form>

      <div className="surface-card border-blue-200 bg-blue-50 text-sm text-blue-900">
        <p className="font-medium">Stripe sandbox card (for testing)</p>
        <p className="mt-1">Card: 4242 4242 4242 4242 | Exp: any future date | CVC: any 3 digits</p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
