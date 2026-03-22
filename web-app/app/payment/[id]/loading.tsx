export default function LoadingPaymentPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <section className="animate-pulse rounded-3xl border border-slate-200 bg-slate-50/60 p-6 md:p-8">
        <div className="h-3 w-44 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-2/3 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-4/5 rounded bg-slate-200" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-10 rounded bg-slate-200" />
          <div className="h-10 rounded bg-slate-200" />
          <div className="h-10 rounded bg-slate-200" />
          <div className="h-10 rounded bg-slate-200" />
          <div className="h-10 rounded bg-slate-200" />
        </div>

        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="mt-4 h-8 w-2/3 rounded bg-slate-200" />
          <div className="mt-6 space-y-2">
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-4 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
