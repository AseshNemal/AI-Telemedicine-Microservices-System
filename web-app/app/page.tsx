export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-shell relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-100/70 blur-2xl" />
        <div className="absolute -left-16 -bottom-20 h-56 w-56 rounded-full bg-emerald-100/70 blur-2xl" />

        <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="section-kicker">Trusted Digital Care Platform</p>
            <h1 className="section-title">Connected Telemedicine for Patients, Doctors, and Care Teams</h1>
            <p className="section-subtitle">
              Access secure virtual care, intelligent symptom guidance, specialist discovery,
              appointment scheduling, and streamlined billing in one modern healthcare experience.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/symptoms" className="btn-primary">Start Symptom Check</a>
              <a href="/doctors" className="btn-secondary">Find Doctors</a>
              <a href="/appointments" className="btn-secondary">Book Appointment</a>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Care Access</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">24/7 Digital Triage</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Privacy</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">Secure-by-Design</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Experience</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">Fast & Accessible</p>
              </div>
            </div>
          </div>

          <div className="surface-card !p-5 md:!p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Care Entry</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">How can we help today?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose your care path to begin a personalized consultation workflow.
            </p>

            <div className="mt-4 grid gap-2">
              <a href="/symptoms" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800 transition hover:bg-cyan-100">AI Symptom Checker</a>
              <a href="/appointments" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Schedule Consultation</a>
              <a href="/payments" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Manage Payments</a>
            </div>

            <p className="mt-4 text-xs text-slate-500">For urgent medical emergencies, contact your local emergency services immediately.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card">
          <h3 className="text-lg font-semibold text-slate-900">For Patients</h3>
          <p className="mt-2 text-sm text-slate-600">Start triage, connect with clinicians, manage visits, and receive follow-up guidance from anywhere.</p>
        </article>
        <article className="surface-card">
          <h3 className="text-lg font-semibold text-slate-900">For Doctors</h3>
          <p className="mt-2 text-sm text-slate-600">Manage schedules, review patient history, coordinate teleconsultations, and improve care continuity.</p>
        </article>
        <article className="surface-card">
          <h3 className="text-lg font-semibold text-slate-900">For Administrators</h3>
          <p className="mt-2 text-sm text-slate-600">Oversee service performance, notifications, billing integrity, and platform governance in one place.</p>
        </article>
      </section>

      <section className="surface-card">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">Platform Architecture</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Core Microservices Powering Care Delivery</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Our frontend is built to integrate seamlessly with the complete telemedicine ecosystem,
              including production-ready and evolving services.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["API Gateway", "Unified and secure entry point for all client-facing requests."],
            ["Auth Service", "Identity, access control, and secure user session management."],
            ["Patient Service", "Patient profiles, records, and personalized care context."],
            ["Doctor Service", "Doctor directory, availability, and specialty management."],
            ["Appointment Service", "Consultation scheduling, confirmations, and care timelines."],
            ["Telemedicine Service", "Virtual consultation workflows and care session support."],
            ["Payment Service", "Transparent and secure digital billing and transaction handling."],
            ["Notification Service", "Real-time alerts through email and SMS touchpoints."],
            ["Admin Service", "Operational oversight, policy controls, and service governance."],
            ["AI Symptom Checker Service", "Adaptive triage guidance based on patient responses."],
          ].map(([name, desc]) => (
            <article key={name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <article className="surface-card">
          <p className="section-kicker">Why clients choose us</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Built for clinical confidence and patient trust</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>• Guided symptom flow that supports informed next steps</li>
            <li>• Integrated appointments, payments, and notifications</li>
            <li>• Scalable architecture for healthcare organizations of all sizes</li>
            <li>• Clear pathways for patients, doctors, and administrators</li>
          </ul>
        </article>
        <article className="surface-card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Get Started</p>
          <h2 className="mt-2 text-2xl font-bold">Begin Your Digital Care Journey</h2>
          <p className="mt-3 text-sm text-slate-200">
            Start with AI-guided symptom assessment or directly book a consultation with the right specialist.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/symptoms" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">Check Symptoms</a>
            <a href="/appointments" className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">Book Now</a>
          </div>
        </article>
      </section>
    </main>
  );
}
