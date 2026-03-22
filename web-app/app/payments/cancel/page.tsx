import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Payment Cancelled</h1>
      <p className="text-sm text-neutral-600">
        You cancelled the Stripe checkout flow. No charge was made.
      </p>
      <Link href="/payments" className="inline-block rounded bg-black px-4 py-2 text-sm text-white">
        Try payment again
      </Link>
    </main>
  );
}
