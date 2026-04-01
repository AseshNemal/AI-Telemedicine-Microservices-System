"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  Appointment,
  createDoctorAccount,
  getAppointments,
  getDoctors,
  getMe,
  Doctor,
} from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import { getDashboardPathForRole } from "@/app/lib/roleRouting";

type DoctorForm = {
  fullName: string;
  email: string;
  password: string;
  specialty: string;
  hospital: string;
  availability: string;
};

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [displayName, setDisplayName] = useState<string>("Admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>({
    fullName: "",
    email: "",
    password: "",
    specialty: "",
    hospital: "",
    availability: "Mon 09:00, Wed 14:00",
  });

  function doctorKey(doctor: Doctor, index: number) {
    return doctor.id || `${doctor.name}-${doctor.specialty}-${index}`;
  }

  function appointmentKey(appointment: Appointment, index: number) {
    return appointment.id || `${appointment.patientId}-${appointment.doctorId}-${appointment.date}-${appointment.time}-${index}`;
  }

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
        if (role !== "ADMIN") {
          router.push(getDashboardPathForRole(role));
          return;
        }

        setDisplayName(me?.data?.fullName || user.displayName || "Admin");

        const [appointmentData, doctorData] = await Promise.all([
          getAppointments(token),
          getDoctors(),
        ]);

        setAppointments(Array.isArray(appointmentData) ? appointmentData : []);
        setDoctors(Array.isArray(doctorData) ? doctorData : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const stats = useMemo(() => {
    const totalAppointments = appointments.length;
    const pendingPayments = appointments.filter((appointment) => appointment.status === "PENDING_PAYMENT").length;
    const confirmed = appointments.filter((appointment) => appointment.status === "CONFIRMED").length;
    const booked = appointments.filter((appointment) => appointment.status === "BOOKED").length;
    return { totalAppointments, pendingPayments, confirmed, booked, totalDoctors: doctors.length };
  }, [appointments, doctors]);

  async function onCreateDoctor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await createDoctorAccount({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        specialty: form.specialty,
        hospital: form.hospital,
        availability: parseCsv(form.availability),
      });

      setMessage(`Doctor account created: ${response.doctor.name}`);
      setDoctors((current) => [response.doctor, ...current]);
      setForm({
        fullName: "",
        email: "",
        password: "",
        specialty: "",
        hospital: "",
        availability: "Mon 09:00, Wed 14:00",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create doctor account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Admin dashboard</p>
        <h1 className="section-title">Welcome, {displayName}</h1>
        <p className="section-subtitle">
          Review platform activity, create doctor accounts, and monitor appointment flow across the network.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <article className="surface-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Appointments</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalAppointments}</p>
        </article>
        <article className="surface-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending payment</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.pendingPayments}</p>
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
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Doctors</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalDoctors}</p>
        </article>
      </section>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <form onSubmit={onCreateDoctor} className="surface-card space-y-4">
          <div>
            <p className="section-kicker">Provision doctor</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Create a doctor account</h2>
            <p className="mt-2 text-sm text-slate-600">
              This creates both the Firebase auth user and the doctor-service record so the account can log in immediately.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="field-input"
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
            />
            <input
              className="field-input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              className="field-input"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <input
              className="field-input"
              placeholder="Specialty"
              value={form.specialty}
              onChange={(e) => setForm((prev) => ({ ...prev, specialty: e.target.value }))}
              required
            />
            <input
              className="field-input md:col-span-2"
              placeholder="Hospital"
              value={form.hospital}
              onChange={(e) => setForm((prev) => ({ ...prev, hospital: e.target.value }))}
              required
            />
            <textarea
              className="field-input md:col-span-2"
              rows={3}
              placeholder="Availability (comma separated)"
              value={form.availability}
              onChange={(e) => setForm((prev) => ({ ...prev, availability: e.target.value }))}
            />
          </div>

          <button className="btn-primary" type="submit" disabled={saving || loading}>
            {saving ? "Creating doctor..." : "Create doctor"}
          </button>
        </form>

        <section className="surface-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Doctor roster</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Active doctors</h2>
            </div>
            <button
              className="btn-secondary text-sm"
              onClick={() => {
                void getDoctors().then((data) => setDoctors(Array.isArray(data) ? data : []));
              }}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {loading && doctors.length === 0 && <p className="text-sm text-slate-600">Loading doctors...</p>}
            {!loading && doctors.length === 0 && <p className="text-sm text-slate-600">No doctor records found yet.</p>}
            {doctors.map((doctor, index) => (
              <article key={doctorKey(doctor, index)} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{doctor.specialty}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{doctor.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{doctor.hospital}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {doctor.availability?.length ? doctor.availability.join(" • ") : "No availability listed"}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="surface-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Appointment overview</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Recent platform activity</h2>
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
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && appointments.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={4}>Loading appointments...</td>
                </tr>
              )}
              {!loading && appointments.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={4}>No appointments available.</td>
                </tr>
              )}
              {appointments.map((appointment, index) => (
                <tr key={appointmentKey(appointment, index)}>
                  <td className="px-4 py-4 font-medium text-slate-900">{appointment.patientName || appointment.patientId}</td>
                  <td className="px-4 py-4 text-slate-600">{appointment.doctorName || appointment.doctorId}</td>
                  <td className="px-4 py-4 text-slate-600">{appointment.date} {appointment.time}</td>
                  <td className="px-4 py-4 text-slate-700">{appointment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
