import type { PaymentRecord } from "@/lib/api/payment";

type PaymentSummaryCardProps = {
  payment: PaymentRecord | null;
  draftAmount: number;
  draftCurrency: string;
};

export default function PaymentSummaryCard({
  payment,
  draftAmount,
  draftCurrency,
}: PaymentSummaryCardProps) {
  const amount = payment?.amount ?? draftAmount;
  const currency = (payment?.currency ?? draftCurrency).toUpperCase();
  const status = payment?.status ?? "NOT_CREATED";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Payment Summary</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">{currency} {Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}</h2>

      <dl className="mt-4 grid gap-2 text-sm text-slate-700">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Payment Status</dt>
          <dd className="font-semibold">{status}</dd>
        </div>
      </dl>
    </article>
  );
}
