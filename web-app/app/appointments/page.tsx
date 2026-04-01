import AppointmentBooking from "@/app/components/AppointmentBooking";
import AppointmentManagement from "@/app/components/AppointmentManagement";

export default function AppointmentsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Consultation flow</p>
        <h1 className="section-title">Book and manage virtual care appointments</h1>
        <p className="section-subtitle">
          Schedule appointments with clinicians, track booking history, and maintain continuity
          across triage, diagnosis, and follow-up.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">01</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Find clinician</h3>
            <p className="mt-1 text-xs text-slate-600">Search and select the doctor for your needs.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">02</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Pick slot</h3>
            <p className="mt-1 text-xs text-slate-600">Set your preferred date and time for consultation.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">03</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Get confirmed</h3>
            <p className="mt-1 text-xs text-slate-600">Manage and join your booked appointments.</p>
          </article>
        </div>
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <AppointmentBooking />
        <AppointmentManagement />
      </div>
    </main>
  );
}
