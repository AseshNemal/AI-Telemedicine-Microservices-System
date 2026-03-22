"use client";

import { FormEvent, useState } from "react";
import { createPayment } from "@/app/lib/api";

export default function PaymentConsole() {
  const [appointmentId, setAppointmentId] = useState("apt-001");
  const [patientId, setPatientId] = useState("pat-001");
  const [doctorId, setDoctorId] = useState("doc-001");
  const [amount, setAmount] = useState("150");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      });

      if (!payment.checkoutUrl) {
        throw new Error("Checkout URL not returned from payment service");
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
      <form onSubmit={onSubmit} className="grid gap-3 rounded border p-4 md:grid-cols-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          value={appointmentId}
          onChange={(e) => setAppointmentId(e.target.value)}
          placeholder="Appointment ID"
          required
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="Patient ID"
          required
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          placeholder="Doctor ID"
          required
        />
        <input
          type="number"
          min="1"
          step="0.01"
          className="rounded border px-3 py-2 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          required
        />

        <input
          className="rounded border px-3 py-2 text-sm md:col-span-2"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="Currency (USD)"
          required
        />

        <button
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 md:col-span-2"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating payment..." : "Pay with Stripe"}
        </button>
      </form>

      <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Stripe Sandbox test card</p>
        <p className="mt-1">Card: 4242 4242 4242 4242 | Exp: any future date | CVC: any 3 digits</p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
