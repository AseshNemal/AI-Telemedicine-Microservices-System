import PaymentConsole from "@/app/components/PaymentConsole";

export default function PaymentsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="text-sm text-neutral-600">
        Create a payment session and continue to Stripe Checkout in sandbox mode.
      </p>
      <PaymentConsole />
    </main>
  );
}
