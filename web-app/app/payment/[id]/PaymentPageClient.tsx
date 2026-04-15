"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import {
  createPayment,
  getPayment,
  verifyPayment,
  type PaymentMethod,
  type PaymentRecord,
} from "@/lib/api/payment";
import PaymentDetails from "@/app/components/payment/PaymentDetails";
import PaymentStatus from "@/app/components/payment/PaymentStatus";
import PaymentSummaryCard from "@/app/components/payment/PaymentSummaryCard";

type PaymentPageClientProps = {
  paymentId: string;
};

export default function PaymentPageClient({ paymentId }: PaymentPageClientProps) {
  const searchParams = useSearchParams();

  const [idToken, setIdToken] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [patientId, setPatientId] = useState("pat-001");
  const [doctorId, setDoctorId] = useState("doc-001");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");

  const statusParam = searchParams.get("status");
  const sessionId = searchParams.get("session_id");

  // Firebase auth listener
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
        setError("Please sign in to manage your payment.");
        setLoadingPayment(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!idToken) return;
    let mounted = true;

    async function loadPayment() {
      setLoadingPayment(true);
      setError(null);

      try {
        const existing = await getPayment(paymentId, idToken!);
        if (!mounted) return;

        if (existing) {
          setPayment(existing);
          setPatientId(existing.patientId || "pat-001");
          setDoctorId(existing.doctorId || "doc-001");
          setAmount(String(existing.amount || ""));
          setCurrency((existing.currency || "USD").toUpperCase());
          setPaymentMethod(existing.paymentMethod || "CARD");
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to fetch payment data");
      } finally {
        if (mounted) setLoadingPayment(false);
      }
    }

    loadPayment();

    return () => {
      mounted = false;
    };
  }, [paymentId, idToken]);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;

    async function verifyFromReturnUrl() {
      if (statusParam !== "success" || !sessionId) return;
      setProcessing(true);
      setError(null);

      try {
        const result = await verifyPayment(sessionId, idToken!);
        if (cancelled) return;
        setStatusMessage(result.message || "Payment verified successfully");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Payment verification failed");
      } finally {
        if (!cancelled) setProcessing(false);
      }
    }

    verifyFromReturnUrl();

    return () => {
      cancelled = true;
    };
  }, [sessionId, statusParam, idToken]);

  const tone = useMemo<"neutral" | "success" | "error" | "warning">(() => {
    if (error) return "error";
    if (statusParam === "cancel") return "warning";
    if (statusMessage) return "success";
    return "neutral";
  }, [error, statusMessage, statusParam]);

  async function onPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken) {
      setError("Please sign in to continue with payment.");
      return;
    }
    setProcessing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const amountValue = Number(amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const created = await createPayment({
        appointmentId: payment?.appointmentId || paymentId,
        patientId,
        doctorId,
        amount: amountValue,
        currency,
        paymentMethod,
      }, idToken);

      if (!created.checkoutUrl) {
        throw new Error("Checkout URL not returned from backend");
      }

      if (!created.checkoutUrl.startsWith("https://checkout.stripe.com/")) {
        throw new Error("Invalid checkout URL received");
      }

      window.location.href = created.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize payment");
      setProcessing(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-7 shadow-sm md:p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Telemedicine Checkout</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">Secure Payment</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
          Review the billing details below, continue to secure Stripe checkout, and return for instant payment status updates.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          {loadingPayment ? (
            <div className="animate-pulse space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
              <div className="h-10 rounded bg-slate-200" />
            </div>
          ) : (
            <PaymentDetails
              patientId={patientId}
              doctorId={doctorId}
              amount={amount}
              currency={currency}
              paymentMethod={paymentMethod}
              disabled={processing}
              onPatientIdChange={setPatientId}
              onDoctorIdChange={setDoctorId}
              onAmountChange={setAmount}
              onCurrencyChange={setCurrency}
              onPaymentMethodChange={setPaymentMethod}
              onSubmit={onPay}
            />
          )}

          <PaymentStatus
            title={
              error
                ? "Payment issue"
                : statusParam === "cancel"
                  ? "Checkout cancelled"
                  : statusMessage
                    ? "Payment verified"
                    : "Ready to pay"
            }
            description={
              error ??
              (statusParam === "cancel"
                ? "You cancelled the Stripe checkout flow. Update details and try again."
                : statusMessage ?? "Click continue to start Stripe checkout.")
            }
            tone={tone}
          />
        </div>

        <PaymentSummaryCard
          payment={payment}
          draftAmount={Number(amount) || 0}
          draftCurrency={currency || "USD"}
        />
      </div>
    </main>
  );
}
