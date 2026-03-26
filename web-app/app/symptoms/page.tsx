import SymptomConsole from "@/app/components/SymptomConsole";

export default function SymptomsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">AI symptom checker</p>
        <h1 className="section-title">Start a guided symptom assessment</h1>
        <p className="section-subtitle">
          Share what you are feeling and receive adaptive next questions, risk-level guidance,
          and recommended care next steps.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">01</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Describe symptoms</h3>
            <p className="mt-1 text-xs text-slate-600">Begin with your primary concern in plain language.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">02</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Answer follow-ups</h3>
            <p className="mt-1 text-xs text-slate-600">Get dynamic questions tailored to your responses.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">03</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Review care guidance</h3>
            <p className="mt-1 text-xs text-slate-600">Understand urgency and recommended next actions.</p>
          </article>
        </div>
      </section>

      <SymptomConsole />

      <section className="surface-card">
        <p className="section-kicker">Important notice</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Emergency symptoms need immediate care</h2>
        <p className="mt-3 text-sm text-slate-600">
          If you experience chest pain, severe breathing difficulty, confusion, or signs of stroke,
          contact emergency services immediately.
        </p>
      </section>
    </main>
  );
}
