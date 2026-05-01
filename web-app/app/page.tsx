const specialistIcon = {
  symptom: (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" />
      <path d="M5.64 5.64l1.77 1.77M16.59 16.59l1.77 1.77M5.64 18.36l1.77-1.77M16.59 7.41l1.77-1.77" />
    </svg>
  ),
  lungs: (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v10" />
      <path d="M6 8C4 9 3 11 3 14c0 3.5 2 5 4 5s3-1.5 3-3v-6" />
      <path d="M18 8c2 1 3 3 3 6 0 3.5-2 5-4 5s-3-1.5-3-3v-6" />
    </svg>
  ),
  calendar: (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  brain: (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a2.5 2.5 0 1 1 0 5" />
      <path d="M14.5 2a2.5 2.5 0 1 0 0 5" />
      <path d="M12 7v13" />
      <path d="M7 10a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3h2" />
      <path d="M17 10a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-2" />
    </svg>
  ),
};

const specialists = [
  {
    key: "symptom",
    title: "AI Symptom Check",
    desc: "Adaptive triage guidance using AI based on your symptoms and health history.",
    href: "/symptoms",
    active: false,
  },
  {
    key: "lungs",
    title: "Telemedicine",
    desc: "Live video consultations with licensed doctors from the comfort of your home.",
    href: "/telemedicine",
    active: true,
  },
  {
    key: "calendar",
    title: "Appointments",
    desc: "Schedule, manage, and track your consultations with specialists easily.",
    href: "/appointments",
    active: false,
  },
  {
    key: "brain",
    title: "Mental Health",
    desc: "Connect with certified therapists and mental wellness specialists online.",
    href: "/doctors",
    active: false,
  },
] as const;

export default function Home() {
  return (
    <main>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="bg-blue-50">
        <div className="mx-auto max-w-7xl px-4 pt-14 pb-0 md:px-8 md:pt-20">
          <div className="grid items-end gap-10 md:grid-cols-[1fr_340px]">

            {/* Left */}
            <div className="pb-10 md:pb-16">
              <p className="section-kicker">Trusted Digital Care Platform</p>
              <h1 className="section-title">
                Find &amp; Search Your{" "}
                <span className="text-blue-600 underline decoration-blue-300 decoration-wavy underline-offset-4">
                  Favourite
                </span>{" "}
                Doctor
              </h1>
              <p className="section-subtitle">
                Access secure virtual care, intelligent symptom guidance, specialist discovery,
                appointment scheduling, and streamlined billing — all in one modern healthcare experience.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a href="/symptoms" className="btn-primary">Start Symptom Check</a>
                <a href="/doctors" className="btn-secondary">Find Doctors</a>
                <a href="/appointments" className="btn-secondary">Book Appointment</a>
              </div>
            </div>

            {/* Right: Doctor photo + blue circle */}
            <div className="relative flex items-end justify-center">
              <div className="absolute bottom-0 right-4 h-64 w-64 rounded-full bg-blue-200/80 md:h-80 md:w-80" />
              <img
                src="/doctor-hero.jpg"
                alt="Doctor"
                className="relative z-10 h-64 w-full rounded-t-3xl object-cover object-top md:h-80"
              />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="bg-blue-600">
          <div className="mx-auto grid max-w-7xl grid-cols-3 px-4 text-white md:px-8">
            <div className="border-r border-blue-500 py-5 text-center">
              <p className="text-2xl font-bold md:text-3xl">24/7</p>
              <p className="mt-0.5 text-xs text-blue-100">Online Support</p>
            </div>
            <div className="border-r border-blue-500 py-5 text-center">
              <p className="text-2xl font-bold md:text-3xl">100+</p>
              <p className="mt-0.5 text-xs text-blue-100">Doctors</p>
            </div>
            <div className="py-5 text-center">
              <p className="text-2xl font-bold md:text-3xl">1M+</p>
              <p className="mt-0.5 text-xs text-blue-100">Active Patients</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Consulting Specialists ───────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Our Consulting Specialists</h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {specialists.map(({ key, title, desc, href, active }) => (
            <a
              key={key}
              href={href}
              className={`group rounded-2xl border p-6 transition hover:-translate-y-1 hover:shadow-md ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-100 bg-white hover:border-blue-200"
              }`}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                  active ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                }`}
              >
                {specialistIcon[key]}
              </div>
              <h3 className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                {title}
              </h3>
              <p className={`mt-2 text-xs leading-5 ${active ? "text-blue-100" : "text-slate-500"}`}>
                {desc}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* ── Why You Choose Us ────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:grid-cols-2 md:px-8">
          <div className="overflow-hidden rounded-3xl">
            <img
              src="/surgeon.jpg"
              alt="Surgeon"
              className="h-96 w-full object-cover"
            />
          </div>

          <div>
            <p className="section-kicker">Why You Choose Us</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              Why You Choose Us?
            </h2>

            <ul className="mt-6 space-y-4 text-sm text-slate-600">
              {[
                "Guided symptom flow that supports informed next steps",
                "Integrated appointments, payments, and notifications",
                "Scalable architecture for healthcare organizations of all sizes",
                "Clear pathways for patients, doctors, and administrators",
                "Secure, Firebase-authenticated access for all roles",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <a href="/doctors" className="btn-primary mt-8 inline-block">
              Learn More →
            </a>
          </div>
        </div>
      </section>

      {/* ── What Our Members Say ─────────────────────────────────────── */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:grid-cols-2 md:px-8">

          <div>
            <p className="section-kicker">Testimonials</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              What Our{" "}
              <span className="text-blue-600">Member&apos;s</span>{" "}
              Saying About Us
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              Thousands of patients trust our platform for fast, reliable, and compassionate digital healthcare.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-xs font-bold text-blue-600 shadow-sm"
                >
                  {["JC", "MR", "AS", "PK", "LT"][i]}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">100+ Reviews</p>
          </div>

          <div className="surface-card">
            <div className="flex items-center gap-3">
              <img
                src="/avatar-jane.jpg"
                alt="Jane Cooper"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Jane Cooper</p>
                <p className="text-xs text-slate-500">Verified Patient</p>
              </div>
              <div className="ml-auto flex text-yellow-400">
                {"★★★★★"}
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              &ldquo;The telemedicine service was absolutely outstanding. I consulted a specialist within minutes from home — no waiting rooms, no travel. The AI symptom checker guided me perfectly before the appointment. Highly recommended!&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ── The Future of Quality Health ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="section-kicker">Healthcare Innovation</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              The Future of{" "}
              <span className="text-blue-600">Quality Health</span>
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Our platform bridges the gap between patients and world-class healthcare professionals
              through cutting-edge telemedicine technology. From AI-powered symptom analysis to
              real-time video consultations, we are redefining how healthcare is delivered.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Whether you need urgent triage, specialist advice, or ongoing care management,
              our distributed microservices platform ensures fast, secure, and seamless access
              to the care you deserve — anytime, anywhere.
            </p>
            <a href="/symptoms" className="btn-primary mt-7 inline-block">
              Learn More →
            </a>
          </div>

          <div className="overflow-hidden rounded-3xl">
            <img
              src="/doctor-patient.jpg"
              alt="Doctor consulting patient"
              className="h-80 w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Subscribe to Newsletter ──────────────────────────────────── */}
      <section className="bg-blue-600 px-4 py-16 text-center text-white md:px-8">
        <h2 className="text-2xl font-bold md:text-3xl">Subscribe To Our Newsletter</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-blue-100">
          Stay updated with the latest health tips, service updates, and exclusive offers from our care platform.
        </p>
        <form
          className="mx-auto mt-8 flex max-w-md overflow-hidden rounded-full bg-white shadow-lg"
        >
          <input
            type="email"
            placeholder="Enter your email address..."
            className="flex-1 bg-transparent px-5 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </section>

    </main>
  );
}
