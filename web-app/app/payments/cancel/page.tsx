import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Checkout Result</p>
        <h1 className="section-title">Payment Cancelled</h1>
        <p className="section-subtitle">
        You cancelled the Stripe checkout flow. No charge was made.
        </p>
      </section>
      <Link href="/payments" className="btn-primary inline-block">
        Try payment again
      </Link>
    </main>
  );
}
