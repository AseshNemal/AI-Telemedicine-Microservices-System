import PaymentConsole from "@/app/components/PaymentConsole";
import Link from "next/link";

export default function PaymentsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Billing & Checkout</p>
        <h1 className="section-title">Payments</h1>
        <p className="section-subtitle">
        Create a payment session and continue to Stripe Checkout in sandbox mode.
        </p>
      </section>
      <div className="surface-card text-sm">
        <p className="text-slate-700">New UX preview:</p>
        <Link href="/payment/apt-001" className="btn-primary mt-2 inline-block text-xs">
          Open redesigned payment page
        </Link>
      </div>
      <PaymentConsole />
    </main>
  );
}
