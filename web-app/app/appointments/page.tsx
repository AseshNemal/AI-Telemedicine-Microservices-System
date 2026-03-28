import AppointmentConsole from "@/app/components/AppointmentConsole";
import { getAppointments } from "@/app/lib/api";

export default async function AppointmentsPage() {
  const initialAppointments = await getAppointments().catch(() => []);

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
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Select clinician</h3>
            <p className="mt-1 text-xs text-slate-600">Choose the doctor aligned to your case.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">02</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Pick slot</h3>
            <p className="mt-1 text-xs text-slate-600">Set your preferred date and consultation time.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">03</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Get confirmed</h3>
            <p className="mt-1 text-xs text-slate-600">Track status and prepare for your visit.</p>
          </article>
        </div>
      </section>

      <AppointmentConsole initialAppointments={initialAppointments} />
    </main>
  );
}
