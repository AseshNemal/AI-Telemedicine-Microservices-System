export default function Home() {
  return (
    <main className="page-shell">

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="hero-shell relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />

        <div className="relative grid gap-10 md:grid-cols-[1.3fr_0.7fr] md:items-center">
          <div>
            <p className="section-kicker">Trusted Digital Care Platform</p>
            <h1 className="section-title">
              Find &amp; Search Your{" "}
              <span className="text-blue-600 underline decoration-blue-300 underline-offset-4">
                Favourite
              </span>{" "}
              Doctor
            </h1>
            <p className="section-subtitle">
              Access secure virtual care, intelligent symptom guidance, specialist
              discovery, appointment scheduling, and streamlined billing in one
              modern healthcare experience.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/symptoms" className="btn-primary">Start Symptom Check</a>
              <a href="/doctors" className="btn-secondary">Find Doctors</a>
              <a href="/appointments" className="btn-secondary">Book Appointment</a>
            </div>

            {/* Stats bar */}
            <div className="mt-8 grid grid-cols-3 overflow-hidden rounded-2xl bg-blue-600 text-white">
              <div className="py-5 text-center">
                <p className="text-2xl font-bold">24/7</p>
                <p className="mt-0.5 text-xs text-blue-100">Online Support</p>
              </div>
              <div className="border-x border-blue-500 py-5 text-center">
                <p className="text-2xl font-bold">100+</p>
                <p className="mt-0.5 text-xs text-blue-100">Doctors</p>
              </div>
              <div className="py-5 text-center">
                <p className="text-2xl font-bold">1M+</p>
                <p className="mt-0.5 text-xs text-blue-100">Active Patients</p>
              </div>
            </div>
          </div>

          {/* Quick care card */}
          <div className="surface-card !p-5 md:!p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Quick Care Entry
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              How can we help today?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Choose your care path to begin a personalized consultation workflow.
            </p>

            <div className="mt-4 grid gap-2">
              <a
                href="/symptoms"
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                AI Symptom Checker
              </a>
              <a
                href="/appointments"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Schedule Consultation
              </a>
              <a
                href="/payments"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Manage Payments
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              For urgent medical emergencies, contact your local emergency services immediately.
            </p>
          </div>
        </div>
      </section>

      {/* ── Our Consulting Services ──────────────────────────────────── */}
      <section>
        <div className="text-center">
          <p className="section-kicker">What We Offer</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Our Consulting Services
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "🩺", title: "AI Symptom Checker", desc: "Adaptive triage guidance based on patient responses and symptoms.", href: "/symptoms", active: false },
            { icon: "📹", title: "Telemedicine", desc: "Virtual consultation workflows with live video and care sessions.", href: "/telemedicine", active: true },
            { icon: "📅", title: "Appointments", desc: "Consultation scheduling, confirmations, and care timelines.", href: "/appointments", active: false },
            { icon: "🧠", title: "Mental Health", desc: "Connect with specialists for mental wellness and support.", href: "/doctors", active: false },
          ].map(({ icon, title, desc, href, active }) => (
            <a
              key={title}
              href={href}
              className={`rounded-2xl border p-6 text-center transition hover:-translate-y-1 hover:shadow-md ${
                active
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-100 bg-white text-slate-700 hover:border-blue-200"
              }`}
            >
              <div
                className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                  active ? "bg-white/20" : "bg-blue-50"
                }`}
              >
                {icon}
              </div>
              <h3 className={`text-sm font-semibold ${active ? "text-white" : "text-slate-800"}`}>
                {title}
              </h3>
              <p className={`mt-2 text-xs leading-5 ${active ? "text-blue-100" : "text-slate-500"}`}>
                {desc}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* ── Why Choose Us ───────────────────────────────────────────── */}
      <section className="grid items-center gap-10 md:grid-cols-2">
        {/* Image placeholder */}
        <div className="relative h-72 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-100 to-blue-50 md:h-96">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-blue-300">
            <svg className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm font-medium">Clinical Excellence</p>
          </div>
        </div>

        <div>
          <p className="section-kicker">Why You Choose Us</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Built for Clinical Confidence and Patient Trust
          </h2>
          <ul className="mt-6 space-y-4 text-sm text-slate-600">
            {[
              "Guided symptom flow that supports informed next steps",
              "Integrated appointments, payments, and notifications",
              "Scalable architecture for healthcare organizations of all sizes",
              "Clear pathways for patients, doctors, and administrators",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <a href="/doctors" className="btn-primary mt-7 inline-block">
            Learn More →
          </a>
        </div>
      </section>

      {/* ── For Patients / Doctors / Admins ─────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card border-t-4 border-t-blue-500">
          <h3 className="text-lg font-semibold text-slate-900">For Patients</h3>
          <p className="mt-2 text-sm text-slate-500">
            Start triage, connect with clinicians, manage visits, and receive follow-up guidance from anywhere.
          </p>
        </article>
        <article className="surface-card border-t-4 border-t-indigo-500">
          <h3 className="text-lg font-semibold text-slate-900">For Doctors</h3>
          <p className="mt-2 text-sm text-slate-500">
            Manage schedules, review patient history, coordinate teleconsultations, and improve care continuity.
          </p>
        </article>
        <article className="surface-card border-t-4 border-t-cyan-500">
          <h3 className="text-lg font-semibold text-slate-900">For Administrators</h3>
          <p className="mt-2 text-sm text-slate-500">
            Oversee service performance, notifications, billing integrity, and platform governance in one place.
          </p>
        </article>
      </section>

      {/* ── Platform Architecture ────────────────────────────────────── */}
      <section className="surface-card">
        <div>
          <p className="section-kicker">Platform Architecture</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Core Microservices Powering Care Delivery
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Our frontend integrates seamlessly with the complete telemedicine ecosystem,
            including production-ready and evolving services.
          </p>
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
            ["AI Symptom Checker", "Adaptive triage guidance based on patient responses."],
          ].map(([name, desc]) => (
            <article
              key={name}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
            >
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-bold text-white">
                {name.slice(0, 1)}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
              <p className="mt-1 text-xs text-slate-500">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Newsletter / CTA ─────────────────────────────────────────── */}
      <section className="rounded-3xl bg-blue-600 px-8 py-16 text-center text-white">
        <h2 className="text-2xl font-bold md:text-3xl">
          Begin Your Digital Care Journey
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-blue-100">
          Start with AI-guided symptom assessment or directly book a consultation
          with the right specialist for your needs.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/symptoms"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Check Symptoms
          </a>
          <a
            href="/appointments"
            className="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Book Now
          </a>
        </div>
      </section>

    </main>
  );
}
