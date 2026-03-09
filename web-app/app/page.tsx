export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-6 md:p-10">
      <section className="rounded-2xl border p-8 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-neutral-500">AI Telemedicine Microservices System</p>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">Cloud-native telemedicine starter platform</h1>
        <p className="mt-4 max-w-3xl text-neutral-600">
          This starter demonstrates distributed microservices with Go + Gin, Docker Compose orchestration,
          Kubernetes-ready manifests, and a Next.js frontend for doctor discovery and appointment booking.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/auth" className="rounded bg-black px-4 py-2 text-sm text-white">Auth</a>
          <a href="/doctors" className="rounded border px-4 py-2 text-sm">Browse Doctors</a>
          <a href="/appointments" className="rounded border px-4 py-2 text-sm">Book Appointment</a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded border p-4">
            <h3 className="font-semibold">Patient</h3>
            <p className="mt-2 text-sm text-neutral-600">Register, discover doctors, book and track consultation appointments.</p>
          </article>
          <article className="rounded border p-4">
            <h3 className="font-semibold">Doctor</h3>
            <p className="mt-2 text-sm text-neutral-600">Create profile, define availability, and manage scheduled sessions.</p>
          </article>
          <article className="rounded border p-4">
            <h3 className="font-semibold">Admin</h3>
            <p className="mt-2 text-sm text-neutral-600">Approve providers and monitor platform usage and operations.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
