"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Appointment, createAppointment, getAppointments } from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";

type AppointmentConsoleProps = {
  initialAppointments: Appointment[];
};

export default function AppointmentConsole({ initialAppointments }: AppointmentConsoleProps) {
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(token?: string) {
    const authToken = token || idToken;
    if (!authToken) {
      setError("Please login first to access appointments.");
      return;
    }
    try {
      const data = await getAppointments(authToken);
      setAppointments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    }
  }
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!idToken) {
      setError("Please login first to book an appointment.");
      return;
    }

    try {
      const created = await createAppointment({
        patientName,
        patientEmail,
        doctorId,
        specialty,
        date,
        time,
      }, idToken);
      setMessage(`Booked: ${created.id}`);
      setDate("");
      setTime("");
      await load(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment");
    }
  }

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIdToken(null);
        return;
      }
      const token = await user.getIdToken();
      setIdToken(token);
      setPatientName(user.displayName || user.email?.split("@")[0] || "Patient");
      setPatientEmail(user.email || "");
      await load(token);
    });

    return () => unsubscribe();
  }, []);

  return (
    <section className="space-y-6">
      <form onSubmit={onSubmit} className="surface-card">
        <p className="section-kicker">Book appointment</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Schedule your consultation</h2>
        <p className="mt-2 text-sm text-slate-600">Provide patient and doctor details, then select your preferred slot.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            className="field-input"
            placeholder="Patient ID (e.g. PAT-1203)"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            disabled
          />
          <input
            className="field-input"
            placeholder="Patient name"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            required
          />
          <input
            className="field-input"
            type="email"
            placeholder="Patient email"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            required
          />
          <input
            className="field-input"
            placeholder="Doctor ID (e.g. DOC-0042)"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            required
          />
          <input
            className="field-input"
            placeholder="Specialty (e.g. Cardiology)"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            required
          />
          <input
            type="date"
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            required
          />
          <input
            type="time"
            className="field-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step="900"
            required
          />
          <button className="btn-primary md:col-span-2" type="submit">
            Confirm appointment
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Appointment history</h3>
        {appointments.length === 0 ? (
          <p className="surface-card text-sm text-slate-500">No appointments yet. Your confirmed bookings will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {appointments.map((a) => (
              <li key={a.id} className="surface-card text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{a.id}</p>
                <p className="mt-1">Patient: {a.patientId}</p>
                <p>Doctor: {a.doctorId}</p>
                <p>Date & Time: {a.date} {a.time}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">Status: {a.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
