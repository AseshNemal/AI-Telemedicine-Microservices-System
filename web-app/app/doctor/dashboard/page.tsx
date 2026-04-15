"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  Appointment,
  Doctor,
  DoctorAvailability,
  MedicalReport,
  doctorEndConsultation,
  doctorStartConsultation,
  getAppointmentsForDoctor,
  getConsultationToken,
  getDoctorAvailability,
  getDoctorPatientReports,
  getMyDoctorProfile,
  initializeDoctorProfile,
  getMe,
  updateDoctorAvailability,
  updateMyDoctorProfile,
} from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";
import { getDashboardPathForRole } from "@/app/lib/roleRouting";

const WEEK_DAYS = [
  { day_of_week: 0, label: "Sunday" },
  { day_of_week: 1, label: "Monday" },
  { day_of_week: 2, label: "Tuesday" },
  { day_of_week: 3, label: "Wednesday" },
  { day_of_week: 4, label: "Thursday" },
  { day_of_week: 5, label: "Friday" },
  { day_of_week: 6, label: "Saturday" },
];

type EditableAvailabilityDay = {
  day_of_week: number;
  label: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
  appointment_type: "PHYSICAL" | "VIRTUAL" | "BOTH";
  hospital: string;
};

const HOSPITAL_OPTIONS = [
  "Lanka Hospital",
  "National Hospital",
  "Asiri Hospital",
  "Durdans Hospital",
  "Nawaloka Hospital",
  "Other",
];

function buildAvailabilityForm(slots: DoctorAvailability[] = []): EditableAvailabilityDay[] {
  return WEEK_DAYS.map((day) => {
    const found = slots.find((slot) => slot.day_of_week === day.day_of_week);
    const appointmentType = (found?.appointment_type || "VIRTUAL") as "PHYSICAL" | "VIRTUAL" | "BOTH";
    return {
      day_of_week: day.day_of_week,
      label: day.label,
      enabled: Boolean(found),
      start_time: found?.start_time || "09:00",
      end_time: found?.end_time || "17:00",
      appointment_type: appointmentType,
      hospital: found?.hospital || "Lanka Hospital",
    };
  });
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [displayName, setDisplayName] = useState<string>("Doctor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reportsByAppointment, setReportsByAppointment] = useState<Record<string, MedicalReport[]>>({});
  const [reportsLoadingId, setReportsLoadingId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState<EditableAvailabilityDay[]>(buildAvailabilityForm());
  const [profileForm, setProfileForm] = useState({
    name: "",
    specialty: "",
    experienceYears: "",
    consultationFeeCents: "",
  });

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
        
        let profile = null;
        try {
          profile = await getMyDoctorProfile(token);
        } catch (fetchErr) {
          // If profile doesn't exist, try to initialize it
          try {
            profile = await initializeDoctorProfile(token);
          } catch (initErr) {
            console.error("Failed to fetch and initialize profile:", fetchErr, initErr);
            setError("Doctor profile not found and could not be auto-created. Please contact support.");
          }
        }

        if (profile) {
          setDoctorProfile(profile);
          setProfileForm({
            name: profile.name || "",
            specialty: profile.specialty || "",
            experienceYears: String(profile.experience_years ?? ""),
            consultationFeeCents: String(profile.consultation_fee_cents ?? ""),
          });
          setDisplayName(profile.name || me?.data?.fullName || user.displayName || "Doctor");

          if (profile.id) {
            const availability = await getDoctorAvailability(profile.id, token).catch((err) => {
              console.error("Failed to fetch availability:", err);
              return [];
            });
            setAvailabilityForm(buildAvailabilityForm(Array.isArray(availability) ? availability : []));
          }

          const doctorAppointments = await getAppointmentsForDoctor(profile.id, token).catch((err) => {
            console.error("Failed to fetch doctor appointments:", err);
            return [];
          });
          setAppointments(Array.isArray(doctorAppointments) ? doctorAppointments : []);
        }
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

  async function loadDoctorAppointments() {
    if (!idToken || !doctorProfile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAppointmentsForDoctor(doctorProfile.id, idToken);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

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
      const joinUrl = `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(result.wsUrl)}&token=${encodeURIComponent(result.token)}`;
      window.open(joinUrl, "_blank", "noopener,noreferrer");
      setMessage("Consultation room opened in a new tab.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join consultation");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartConsultation(id: string) {
    if (!idToken) {
      setError("Please sign in again to start the consultation.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await doctorStartConsultation(id, idToken);
      if (result.meeting_link) {
        window.open(result.meeting_link, "_blank", "noopener,noreferrer");
      }
      setMessage("Consultation started successfully.");
      await loadDoctorAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start consultation");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndConsultation(id: string) {
    if (!idToken) {
      setError("Please sign in again to end the consultation.");
      return;
    }

    const notes = window.prompt("Consultation notes (optional)") || "";
    const prescription = window.prompt("Prescription text (optional)") || "";

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await doctorEndConsultation(id, idToken, { notes, prescription });
      setMessage("Consultation ended successfully.");
      await loadDoctorAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end consultation");
    } finally {
      setLoading(false);
    }
  }

  async function handleViewReports(id: string) {
    if (!idToken) {
      setError("Please sign in again to load patient reports.");
      return;
    }

    setReportsLoadingId(id);
    setError(null);
    setMessage(null);

    try {
      const result = await getDoctorPatientReports(id, idToken);
      const data = Array.isArray(result) ? result : result.data || [];
      setReportsByAppointment((prev) => ({ ...prev, [id]: data }));
      setMessage(`Loaded ${data.length} patient report(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patient reports");
    } finally {
      setReportsLoadingId(null);
    }
  }

  async function handleSaveProfile() {
    if (!idToken) {
      setError("Please sign in again.");
      return;
    }

    const name = profileForm.name.trim();
    const specialty = profileForm.specialty.trim();
    const experienceYears = Number(profileForm.experienceYears || 0);
    const consultationFeeCents = Number(profileForm.consultationFeeCents || 0);

    if (!name || !specialty) {
      setError("Name and specialty are required.");
      return;
    }
    if (Number.isNaN(experienceYears) || experienceYears < 0) {
      setError("Experience years must be a valid non-negative number.");
      return;
    }
    if (Number.isNaN(consultationFeeCents) || consultationFeeCents < 0) {
      setError("Consultation fee (cents) must be a valid non-negative number.");
      return;
    }

    setProfileSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateMyDoctorProfile(idToken, {
        name,
        specialty,
        experience_years: experienceYears,
        consultation_fee_cents: consultationFeeCents,
      });
      setDoctorProfile(updated);
      setDisplayName(updated.name || displayName);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveAvailability() {
    if (!idToken || !doctorProfile?.id) {
      setError("Doctor profile is not loaded yet. Please refresh and try again.");
      return;
    }

    const enabledDays = availabilityForm.filter((item) => item.enabled);
    for (const day of enabledDays) {
      if (!day.start_time || !day.end_time) {
        setError(`Please set both start and end time for ${day.label}.`);
        return;
      }
      if (day.start_time >= day.end_time) {
        setError(`Start time must be before end time for ${day.label}.`);
        return;
      }
      if (!day.appointment_type) {
        setError(`Please select a visit type for ${day.label}.`);
        return;
      }
      if ((day.appointment_type === "PHYSICAL" || day.appointment_type === "BOTH") && !day.hospital.trim()) {
        setError(`Please choose a hospital for ${day.label}.`);
        return;
      }
    }

    setAvailabilitySaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateDoctorAvailability(
        doctorProfile.id,
        enabledDays.map((day) => ({
          day_of_week: day.day_of_week,
          start_time: day.start_time,
          end_time: day.end_time,
          appointment_type: day.appointment_type,
          hospital: day.hospital.trim(),
        })),
        idToken
      );

      setAvailabilityForm(buildAvailabilityForm(updated));
      setMessage("Availability updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setAvailabilitySaving(false);
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Doctor profile</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Edit your profile</h2>
            <p className="mt-2 text-sm text-slate-600">Update your visible details and consultation settings.</p>
          </div>
          {doctorProfile?.verification_status && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${doctorProfile.verification_status === "VERIFIED" ? "bg-emerald-50 text-emerald-700" : doctorProfile.verification_status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
              {doctorProfile.verification_status}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            className="field-input"
            placeholder="Full name"
            value={profileForm.name}
            onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="field-input"
            placeholder="Specialty"
            value={profileForm.specialty}
            onChange={(e) => setProfileForm((prev) => ({ ...prev, specialty: e.target.value }))}
          />
          <input
            className="field-input"
            type="number"
            min={0}
            placeholder="Experience years"
            value={profileForm.experienceYears}
            onChange={(e) => setProfileForm((prev) => ({ ...prev, experienceYears: e.target.value }))}
          />
          <input
            className="field-input"
            type="number"
            min={0}
            step={100}
            placeholder="Consultation fee (cents)"
            value={profileForm.consultationFeeCents}
            onChange={(e) => setProfileForm((prev) => ({ ...prev, consultationFeeCents: e.target.value }))}
          />
          <div className="md:col-span-2">
            <button className="btn-primary" onClick={() => void handleSaveProfile()} disabled={loading || profileSaving || !idToken}>
              {profileSaving ? "Saving profile..." : "Save profile"}
            </button>
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div>
          <p className="section-kicker">Consultation times</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Weekly availability</h2>
          <p className="mt-2 text-sm text-slate-600">Choose which days you accept bookings and set your consultation hours.</p>
        </div>

        <div className="mt-5 space-y-3 overflow-x-auto">
          {availabilityForm.map((day) => (
            <div key={day.day_of_week} className="grid min-w-[900px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[120px_120px_1fr_1fr_180px_200px]">
              <p className="text-sm font-semibold text-slate-900">{day.label}</p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAvailabilityForm((prev) => prev.map((item) => (
                      item.day_of_week === day.day_of_week ? { ...item, enabled: checked } : item
                    )));
                  }}
                />
                Available
              </label>
              <select
                className="field-input"
                value={day.appointment_type}
                disabled={!day.enabled}
                onChange={(e) => {
                  const value = e.target.value as "PHYSICAL" | "VIRTUAL" | "BOTH";
                  setAvailabilityForm((prev) => prev.map((item) => (
                    item.day_of_week === day.day_of_week ? { ...item, appointment_type: value } : item
                  )));
                }}
              >
                <option value="VIRTUAL">Virtual</option>
                <option value="PHYSICAL">Physical</option>
                <option value="BOTH">Both</option>
              </select>
              <input
                className="field-input"
                type="time"
                step={900}
                value={day.start_time}
                disabled={!day.enabled}
                onChange={(e) => {
                  const value = e.target.value;
                  setAvailabilityForm((prev) => prev.map((item) => (
                    item.day_of_week === day.day_of_week ? { ...item, start_time: value } : item
                  )));
                }}
              />
              <input
                className="field-input"
                type="time"
                step={900}
                value={day.end_time}
                disabled={!day.enabled}
                onChange={(e) => {
                  const value = e.target.value;
                  setAvailabilityForm((prev) => prev.map((item) => (
                    item.day_of_week === day.day_of_week ? { ...item, end_time: value } : item
                  )));
                }}
              />
              <div className="flex gap-2">
                <select
                  className="field-input"
                  value={HOSPITAL_OPTIONS.includes(day.hospital) ? day.hospital : "Other"}
                  disabled={!day.enabled || day.appointment_type === "VIRTUAL"}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setAvailabilityForm((prev) => prev.map((item) => (
                      item.day_of_week === day.day_of_week
                        ? { ...item, hospital: selected === "Other" ? item.hospital : selected }
                        : item
                    )));
                  }}
                >
                  {HOSPITAL_OPTIONS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input
                  className="field-input"
                  placeholder="Custom hospital"
                  value={HOSPITAL_OPTIONS.includes(day.hospital) ? "" : day.hospital}
                  disabled={!day.enabled || day.appointment_type === "VIRTUAL"}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAvailabilityForm((prev) => prev.map((item) => (
                      item.day_of_week === day.day_of_week ? { ...item, hospital: value } : item
                    )));
                  }}
                />
              </div>
            </div>
          ))}

          <button
            className="btn-primary"
            onClick={() => void handleSaveAvailability()}
            disabled={loading || availabilitySaving || !idToken || !doctorProfile?.id}
          >
            {availabilitySaving ? "Saving times..." : "Save times"}
          </button>
        </div>
      </section>

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
              void loadDoctorAppointments();
            }}
            disabled={loading || !idToken || !doctorProfile?.id}
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
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
                  <td className="px-4 py-4 text-slate-600">
                    <div>{appointment.specialty || "General"}</div>
                    <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{appointment.appointmentType || "VIRTUAL"}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <div>{appointment.date} {appointment.time}</div>
                    {appointment.appointmentType === "PHYSICAL" && appointment.hospitalName && (
                      <div className="text-xs text-slate-500">Hospital: {appointment.hospitalName}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{appointment.status}</td>
                  <td className="px-4 py-4">
                    {appointment.appointmentType === "VIRTUAL" && (appointment.doctorMeetingLink || appointment.meetingLink) && (
                      <div className="mb-2">
                        <a
                          href={appointment.doctorMeetingLink || appointment.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
                        >
                          Open doctor link
                        </a>
                      </div>
                    )}
                    {appointment.status === "BOOKED" && (
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-primary text-xs" onClick={() => void handleStartConsultation(appointment.id)} disabled={loading}>
                          Start consultation
                        </button>
                        <button className="btn-secondary text-xs" onClick={() => void handleJoinConsultation(appointment.id)} disabled={loading}>
                          Enter room
                        </button>
                        <button className="btn-secondary text-xs" onClick={() => void handleViewReports(appointment.id)} disabled={loading || reportsLoadingId === appointment.id}>
                          {reportsLoadingId === appointment.id ? "Loading reports..." : "Patient reports"}
                        </button>
                        <button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100" onClick={() => void handleEndConsultation(appointment.id)} disabled={loading}>
                          End consultation
                        </button>
                      </div>
                    )}
                    {appointment.status !== "BOOKED" && (
                      <span className="text-xs text-slate-500">{appointment.status === "COMPLETED" ? "Completed" : appointment.status === "REJECTED" ? "Rejected" : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Object.keys(reportsByAppointment).length > 0 && (
          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Patient reports</h3>
            {Object.entries(reportsByAppointment).map(([appointmentId, reports]) => (
              <div key={appointmentId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Appointment {appointmentId}</p>
                {reports.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No reports uploaded.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {reports.map((report) => (
                      <li key={report._id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="font-medium text-slate-900">{report.fileName}</p>
                        <p className="text-xs text-slate-500">{report.fileType} • {new Date(report.uploadedAt).toLocaleString()}</p>
                        {report.description && <p className="text-sm text-slate-600">{report.description}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
