"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Appointment, getAppointments, getConsultationToken, getMe, doctorAcceptAppointment, doctorRejectAppointment } from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import { getDashboardPathForRole } from "@/app/lib/roleRouting";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [displayName, setDisplayName] = useState<string>("Doctor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setError(null);
        setMessage(null);

        if (!user) {
          router.push("/auth");
          return;
        }

        const token = await user.getIdToken();
        setIdToken(token);

        const me = await getMe(token);
        const role = me?.data?.role || "USER";
        if (role !== "DOCTOR") {
          router.push(getDashboardPathForRole(role));
          return;
        }

        setDisplayName(me?.data?.fullName || user.displayName || "Doctor");
        const data = await getAppointments(token);
        setAppointments(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load doctor dashboard");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const booked = appointments.filter((appointment) => appointment.status === "BOOKED").length;
    const confirmed = appointments.filter((appointment) => appointment.status === "CONFIRMED").length;
    const completed = appointments.filter((appointment) => appointment.status === "COMPLETED").length;
    return { total, booked, confirmed, completed };
  }, [appointments]);

  async function handleJoinConsultation(id: string) {
    if (!idToken) {
      setError("Please sign in again to join the consultation.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await getConsultationToken(id, idToken);
      setMessage(`Consultation token created: ${result.token.slice(0, 18)}...`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join consultation");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(id: string) {
    if (!idToken) {
      setError("Please sign in again.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await doctorAcceptAppointment(id, idToken);
      setMessage("Appointment accepted successfully.");
      const data = await getAppointments(idToken);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept appointment");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id: string) {
    if (!idToken) {
      setError("Please sign in again.");
      return;
    }
    if (!confirm("Are you sure you want to reject this appointment? The patient will be refunded automatically.")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await doctorRejectAppointment(id, idToken);
      setMessage("Appointment rejected. The patient has been notified and will be refunded.");
      const data = await getAppointments(idToken);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject appointment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Doctor dashboard</p>
        <h1 className="section-title">Welcome, {displayName}</h1>
        <p className="section-subtitle">
          Review your patient appointments, confirm consultation readiness, and join active sessions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="surface-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
        </article>
        <article className="surface-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Confirmed</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.confirmed}</p>
        </article>
        <article className="surface-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Booked</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.booked}</p>
        </article>
        <article className="surface-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.completed}</p>
        </article>
      </section>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      <section className="surface-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="section-kicker">Your patients</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Appointment list</h2>
            <p className="mt-2 text-sm text-slate-600">See patient names, times, and consultation readiness in one view.</p>
          </div>
          <button
            className="btn-secondary text-sm"
            onClick={() => {
              if (idToken) {
                void getAppointments(idToken).then((data) => setAppointments(Array.isArray(data) ? data : []));
              }
            }}
            disabled={loading || !idToken}
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Specialty</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && appointments.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>Loading appointments...</td>
                </tr>
              )}
              {!loading && appointments.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>No patient appointments assigned yet.</td>
                </tr>
              )}
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-4 py-4 font-medium text-slate-900">{appointment.patientName || appointment.patientId}</td>
                  <td className="px-4 py-4 text-slate-600">{appointment.specialty || "General"}</td>
                  <td className="px-4 py-4 text-slate-600">{appointment.date} {appointment.time}</td>
                  <td className="px-4 py-4 text-slate-700">{appointment.status}</td>
                  <td className="px-4 py-4">
                    {appointment.status === "CONFIRMED" && (
                      <div className="flex gap-2">
                        <button className="btn-primary text-xs" onClick={() => void handleAccept(appointment.id)} disabled={loading}>
                          Accept
                        </button>
                        <button className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100" onClick={() => void handleReject(appointment.id)} disabled={loading}>
                          Reject
                        </button>
                      </div>
                    )}
                    {appointment.status === "BOOKED" && (
                      <button className="btn-primary text-xs" onClick={() => void handleJoinConsultation(appointment.id)} disabled={loading}>
                        Join consultation
                      </button>
                    )}
                    {appointment.status !== "CONFIRMED" && appointment.status !== "BOOKED" && (
                      <span className="text-xs text-slate-500">{appointment.status === "COMPLETED" ? "Completed" : appointment.status === "REJECTED" ? "Rejected" : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
