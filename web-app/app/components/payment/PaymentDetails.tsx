"use client";

import { FormEvent } from "react";
import type { PaymentMethod } from "@/lib/api/payment";
import PayButton from "./PayButton";

type PaymentDetailsProps = {
  patientId: string;
  doctorId: string;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  disabled?: boolean;
  onPatientIdChange: (value: string) => void;
  onDoctorIdChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function PaymentDetails({
  patientId,
  doctorId,
  amount,
  currency,
  paymentMethod,
  disabled,
  onPatientIdChange,
  onDoctorIdChange,
  onAmountChange,
  onCurrencyChange,
  onPaymentMethodChange,
  onSubmit,
}: PaymentDetailsProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <h3 className="text-base font-semibold text-slate-900 md:text-lg">Payment Details</h3>
      <p className="mt-1 text-sm text-slate-500">Update patient/doctor details if needed, then continue to Stripe Checkout.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-500"
          placeholder="Patient ID"
          value={patientId}
          onChange={(e) => onPatientIdChange(e.target.value)}
          disabled={disabled}
          required
        />
        <input
          className="h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-500"
          placeholder="Doctor ID"
          value={doctorId}
          onChange={(e) => onDoctorIdChange(e.target.value)}
          disabled={disabled}
          required
        />
        <input
          type="number"
          min="1"
          step="0.01"
          className="h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-500"
          placeholder="Amount"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={disabled}
          required
        />
        <input
          className="h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-0 focus:border-slate-500"
          placeholder="Currency"
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
          disabled={disabled}
          required
        />
        <select
          className="h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-500 md:col-span-2"
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as PaymentMethod)}
          disabled={disabled}
        >
          <option value="CARD">Card</option>
          <option value="MOBILE">Mobile</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </select>
      </div>

      <div className="mt-5">
        <PayButton type="submit" loading={disabled} disabled={disabled} label="Continue to secure checkout" />
      </div>
    </form>
  );
}
