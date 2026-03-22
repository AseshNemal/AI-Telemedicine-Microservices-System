export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">AI Telemedicine Microservices System</p>
        <h1 className="section-title">Cloud-native telemedicine starter platform</h1>
        <p className="section-subtitle">
          This starter demonstrates distributed microservices with Go + Gin, Docker Compose orchestration,
          Kubernetes-ready manifests, and a Next.js frontend for doctor discovery and appointment booking.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/auth" className="btn-primary">Auth</a>
          <a href="/doctors" className="btn-secondary">Browse Doctors</a>
          <a href="/appointments" className="btn-secondary">Book Appointment</a>
          <a href="/payments" className="btn-secondary">Payments</a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="surface-card">
            <h3 className="font-semibold">Patient</h3>
            <p className="mt-2 text-sm text-neutral-600">Register, discover doctors, book and track consultation appointments.</p>
          </article>
          <article className="surface-card">
            <h3 className="font-semibold">Doctor</h3>
            <p className="mt-2 text-sm text-neutral-600">Create profile, define availability, and manage scheduled sessions.</p>
          </article>
          <article className="surface-card">
            <h3 className="font-semibold">Admin</h3>
            <p className="mt-2 text-sm text-neutral-600">Approve providers and monitor platform usage and operations.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
