import AppointmentConsole from "@/app/components/AppointmentConsole";
import { getAppointments } from "@/app/lib/api";

export default async function AppointmentsPage() {
  const initialAppointments = await getAppointments().catch(() => []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Appointments</h1>
      <p className="text-sm text-neutral-600">
        Book, view, and manage consultation slots.
      </p>
      <AppointmentConsole initialAppointments={initialAppointments} />
    </main>
  );
}
