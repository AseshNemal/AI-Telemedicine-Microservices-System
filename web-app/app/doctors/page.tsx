import DoctorExplorer from "@/app/components/DoctorExplorer";

export default function DoctorsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Care network</p>
        <h1 className="section-title">Find the right specialist for your symptoms</h1>
        <p className="section-subtitle">
          Explore available clinicians by specialty and choose care that matches your needs,
          urgency, and preferred consultation style.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">01</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Search</h3>
            <p className="mt-1 text-xs text-slate-600">Filter by specialty to narrow your options quickly.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">02</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Compare</h3>
            <p className="mt-1 text-xs text-slate-600">Review hospitals and availability for each doctor.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">03</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Book</h3>
            <p className="mt-1 text-xs text-slate-600">Continue to appointments when you find your fit.</p>
          </article>
        </div>
      </section>

      <DoctorExplorer />

      <section className="surface-card">
        <p className="section-kicker">How matching works</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Specialty-first doctor discovery</h2>
        <ul className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <li>• General medicine for initial triage and broad care.</li>
          <li>• Cardiology for chest discomfort and cardiovascular concerns.</li>
          <li>• Neurology for recurring headaches and neurological symptoms.</li>
          <li>• Pediatrics for child-focused virtual consultation pathways.</li>
        </ul>
      </section>
    </main>
  );
}
