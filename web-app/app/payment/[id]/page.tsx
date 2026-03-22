import { Suspense } from "react";
import PaymentPageClient from "./PaymentPageClient";

type PaymentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PaymentPage({ params }: PaymentPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl p-6 md:p-10">Loading payment experience...</main>}>
      <PaymentPageClient paymentId={id} />
    </Suspense>
  );
}
