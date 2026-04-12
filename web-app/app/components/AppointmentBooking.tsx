"use client";

import { FormEvent, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Doctor,
  getDoctors,
  createAppointment,
  getMyPatientProfile,
} from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";

export default function AppointmentBooking() {
  const [step, setStep] = useState<"doctors" | "booking">("doctors");
  const [specialty, setSpecialty] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [latestCheckoutUrl, setLatestCheckoutUrl] = useState<string | null>(null);
  const [latestAppointmentId, setLatestAppointmentId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  // Booking form state
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Platform fee is $20 (2000 cents). Doctor fee comes from API.
  const PLATFORM_FEE_CENTS = 2000;
  const doctorFeeCents = selectedDoctor?.consultation_fee_cents ?? 0;
  const totalCents = doctorFeeCents + PLATFORM_FEE_CENTS;

  // Date constraints: earliest is today, latest is 5 months from now.
  const todayStr = new Date().toISOString().split("T")[0];
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 5);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  // Load doctors
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

  // Handle doctor search
  async function handleSearchDoctors(e: FormEvent) {
    e.preventDefault();
    await loadDoctors(specialty);
  }

  function doctorKey(doctor: Doctor, index: number) {
    return doctor.id || `${doctor.name}-${doctor.specialty}-${index}`;
  }

  // Select doctor and move to booking
  function selectDoctor(doctor: Doctor) {
    setSelectedDoctor(doctor);
    setStep("booking");
  }

  // Handle appointment booking
  async function handleBookAppointment(e: FormEvent) {
    e.preventDefault();
    if (!selectedDoctor) return;
    if (!idToken) {
      setError("Please login first to book an appointment.");
      return;
    }
    if (!patientName || !patientEmail) {
      setError("Your profile is missing name or email. Please re-login.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setLatestCheckoutUrl(null);
    setLatestAppointmentId(null);

    try {
      const appointment = await createAppointment({
        patientName,
        patientEmail,
        patientPhone: patientPhone || undefined,
        doctorId: selectedDoctor.id,
        specialty: selectedDoctor.specialty,
        date,
        time,
      }, idToken);
      setMessage(`✓ Appointment booked successfully (ID: ${appointment.id})`);
      if (appointment.checkoutUrl && appointment.checkoutUrl.startsWith("https://checkout.stripe.com/")) {
        setLatestCheckoutUrl(appointment.checkoutUrl);
      }
      if (appointment.appointment && appointment.appointment.id) {
        setLatestAppointmentId(appointment.appointment.id);
      } else if (appointment.id) {
        setLatestAppointmentId(appointment.id);
      }
      setDate("");
      setTime("");
      setSelectedDoctor(null);
      setStep("doctors");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  }

  // Initialize on mount
  useEffect(() => {
    loadDoctors();

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIdToken(null);
        setPatientName("");
        setPatientEmail("");
        setPatientPhone("");
        return;
      }

      const token = await user.getIdToken();
      setIdToken(token);
      setPatientName(user.displayName || user.email?.split("@")[0] || "Patient");
      setPatientEmail(user.email || "");

      try {
        const profile = await getMyPatientProfile(token);
        setPatientPhone(profile?.data?.phone || user.phoneNumber || "");
      } catch {
        setPatientPhone(user.phoneNumber || "");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      {/* Doctor Selection Step */}
      {step === "doctors" && (
        <section className="surface-card">
          <p className="section-kicker">Step 1 of 2</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Find your doctor</h2>
          <p className="mt-2 text-sm text-slate-600">Search available doctors by specialty or view all professionals.</p>

          <form onSubmit={handleSearchDoctors} className="mt-5 flex flex-wrap gap-3">
            <input
              type="text"
              className="field-input min-w-[200px] flex-1"
              placeholder="e.g. Cardiology, Neurology, Pediatrics"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSpecialty("");
                loadDoctors();
              }}
            >
              Clear
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
          {latestCheckoutUrl && (
            <button
              type="button"
              className="btn-primary mt-3"
              onClick={() => {
                window.location.href = latestCheckoutUrl;
              }}
            >
              Proceed to payment{latestAppointmentId ? ` (${latestAppointmentId})` : ""}
            </button>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {loading && !doctors.length && <p className="text-sm text-slate-600">Loading doctors...</p>}
            {!loading && doctors.length === 0 && (
              <p className="text-sm text-slate-500">No doctors found. Try a different search or view all.</p>
            )}
            {doctors.map((doctor, index) => (
              <article
                key={doctorKey(doctor, index)}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white/90 p-4 transition hover:border-blue-400 hover:shadow-md"
                onClick={() => selectDoctor(doctor)}
              >
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{doctor.specialty}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{doctor.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{doctor.hospital}</p>
                {typeof doctor.consultation_fee_cents === "number" && (
                  <p className="mt-1 text-sm font-medium text-blue-700">
                    Consultation fee: ${(doctor.consultation_fee_cents / 100).toFixed(2)}
                  </p>
                )}
                {doctor.availability && doctor.availability.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Available: {doctor.availability.slice(0, 3).join(", ")}
                    {doctor.availability.length > 3 ? "..." : ""}
                  </p>
                )}
                <button className="btn-primary mt-3 w-full text-sm">Select doctor</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Booking Step */}
      {step === "booking" && selectedDoctor && (
        <section className="space-y-6">
          <article className="surface-card">
            <p className="section-kicker">Selected doctor</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedDoctor.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{selectedDoctor.specialty} • {selectedDoctor.hospital}</p>
            {totalCents > 0 && (
              <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm">
                <p className="font-medium text-slate-800">Cost breakdown</p>
                <p className="text-slate-600">Doctor fee: ${(doctorFeeCents / 100).toFixed(2)}</p>
                <p className="text-slate-600">Platform fee: ${(PLATFORM_FEE_CENTS / 100).toFixed(2)}</p>
                <p className="mt-1 font-semibold text-slate-900">Total: ${(totalCents / 100).toFixed(2)}</p>
              </div>
            )}
            <button
              className="btn-secondary mt-3"
              onClick={() => {
                setSelectedDoctor(null);
                setStep("doctors");
              }}
            >
              Change doctor
            </button>
          </article>

          <form onSubmit={handleBookAppointment} className="surface-card">
            <p className="section-kicker">Step 2 of 2</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Schedule your appointment</h2>
            <p className="mt-2 text-sm text-slate-600">Provide your details and select your preferred time slot.</p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                type="text"
                className="field-input"
                placeholder="Patient name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
              <input
                type="email"
                className="field-input"
                placeholder="Patient email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                required
              />
              <input
                type="tel"
                className="field-input"
                placeholder="Patient phone (optional, for SMS updates)"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
              />
              <input
                type="date"
                className="field-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={todayStr}
                max={maxDateStr}
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
              <div></div>
              <button className="btn-primary md:col-span-2" type="submit" disabled={loading}>
                {loading ? "Booking..." : "Confirm appointment"}
              </button>
            </div>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
        </section>
      )}
    </div>
  );
}
