"use client";

import { FormEvent, useState } from "react";
import { Appointment, createAppointment, getAppointments } from "@/app/lib/api";

type AppointmentConsoleProps = {
  initialAppointments: Appointment[];
};

export default function AppointmentConsole({ initialAppointments }: AppointmentConsoleProps) {
  const [patientId, setPatientId] = useState("patient-001");
  const [doctorId, setDoctorId] = useState("doc-1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await getAppointments();
      setAppointments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    }
  }
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const created = await createAppointment({ patientId, doctorId, date, time });
      setMessage(`Booked: ${created.id}`);
      setDate("");
      setTime("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment");
    }
  }

  return (
    <section className="space-y-6">
      <form onSubmit={onSubmit} className="surface-card grid gap-3 md:grid-cols-2">
        <input
          className="field-input"
          placeholder="Patient ID"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
        />
        <input
          className="field-input"
          placeholder="Doctor ID"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          required
        />
        <input
          type="date"
          className="field-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="time"
          className="field-input"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
        <button className="btn-primary md:col-span-2" type="submit">
          Book Appointment
        </button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        <h3 className="font-semibold">Appointment History</h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-neutral-500">No appointments yet.</p>
        ) : (
          <ul className="space-y-2">
            {appointments.map((a) => (
              <li key={a.id} className="surface-card text-sm">
                <strong>{a.id}</strong> | Patient: {a.patientId} | Doctor: {a.doctorId} | {a.date} {a.time} | {a.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
