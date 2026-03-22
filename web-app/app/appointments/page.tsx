import AppointmentConsole from "@/app/components/AppointmentConsole";
import { getAppointments } from "@/app/lib/api";

export default async function AppointmentsPage() {
  const initialAppointments = await getAppointments().catch(() => []);

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Consultation Flow</p>
        <h1 className="section-title">Appointments</h1>
        <p className="section-subtitle">
        Book, view, and manage consultation slots.
        </p>
      </section>
      <AppointmentConsole initialAppointments={initialAppointments} />
    </main>
  );
}
