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
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Filter by specialty (e.g. Cardiology)"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />
        <button
          className="rounded bg-black px-4 py-2 text-sm text-white"
          onClick={() => loadDoctors(specialty)}
        >
          Search
        </button>
        <button
          className="rounded border px-4 py-2 text-sm"
          onClick={() => {
            setSpecialty("");
            loadDoctors();
          }}
        >
          Reset
        </button>
      </div>

      {loading && <p className="text-sm">Loading doctors...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 md:grid-cols-2">
          {doctors.map((doctor) => (
            <article key={doctor.id} className="rounded border p-4">
              <h3 className="font-semibold">{doctor.name}</h3>
              <p className="text-sm text-neutral-600">{doctor.specialty}</p>
              <p className="text-sm">{doctor.hospital}</p>
              <p className="mt-2 text-xs text-neutral-500">
                Availability: {doctor.availability?.join(", ") || "N/A"}
              </p>
            </article>
          ))}
          {doctors.length === 0 && (
            <p className="text-sm text-neutral-500">No doctors found for this filter.</p>
          )}
        </div>
      )}
    </section>
  );
}
