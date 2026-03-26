"use client";

import { useEffect, useState } from "react";
import { Doctor, getDoctors } from "@/app/lib/api";

export default function DoctorExplorer() {
  const [specialty, setSpecialty] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDoctors(filter?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await getDoctors(filter);
      setDoctors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  return (
    <section className="space-y-6">
      <div className="surface-card">
        <p className="section-kicker">Doctor discovery</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Search by specialty</h2>
        <p className="mt-2 text-sm text-slate-600">
          Filter available doctors by specialty to match your symptoms and care goals.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <input
            className="field-input min-w-[240px] flex-1"
            placeholder="e.g. Cardiology, Neurology, Pediatrics"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={() => loadDoctors(specialty)}
          >
            Search doctors
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setSpecialty("");
              loadDoctors();
            }}
          >
            Clear filter
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-600">Loading doctors...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 md:grid-cols-2">
          {doctors.map((doctor) => (
            <article key={doctor.id} className="surface-card">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{doctor.specialty}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{doctor.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{doctor.hospital}</p>
              <p className="mt-3 text-xs text-slate-500">
                Availability: {doctor.availability?.join(", ") || "N/A"}
              </p>
            </article>
          ))}
          {doctors.length === 0 && (
            <p className="surface-card text-sm text-slate-500">No doctors found for this filter. Try a broader specialty keyword.</p>
          )}
        </div>
      )}
    </section>
  );
}
