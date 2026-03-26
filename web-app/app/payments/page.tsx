import PaymentConsole from "@/app/components/PaymentConsole";
import Link from "next/link";

export default function PaymentsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Billing and checkout</p>
        <h1 className="section-title">Secure payment experience for telemedicine visits</h1>
        <p className="section-subtitle">
          Review consultation fees, initialize checkout, and complete payment through a
          secure Stripe-hosted flow.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">01</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Confirm details</h3>
            <p className="mt-1 text-xs text-slate-600">Validate appointment and participant information.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">02</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Checkout securely</h3>
            <p className="mt-1 text-xs text-slate-600">Complete payment with encrypted processing.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">03</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Track status</h3>
            <p className="mt-1 text-xs text-slate-600">Keep a clear record of payment state and confirmation.</p>
          </article>
        </div>
      </section>

      <div className="surface-card text-sm">
        <p className="text-slate-700">Need a detailed payment view for a specific appointment?</p>
        <Link href="/payment/apt-001" className="btn-primary mt-3 inline-block text-xs">
          Open payment details page
        </Link>
      </div>

      <PaymentConsole />
    </main>
  );
}
