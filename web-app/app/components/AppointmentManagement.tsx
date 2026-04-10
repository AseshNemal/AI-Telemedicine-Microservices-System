"use client";

import { useEffect, useState, FormEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Appointment,
  getAppointmentByID,
  getAppointments,
  rescheduleAppointment,
  cancelAppointment,
  getConsultationToken,
  confirmAppointmentPayment,
} from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";

type AppointmentAction = "view" | "reschedule" | "join" | null;

export default function AppointmentManagement() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [action, setAction] = useState<AppointmentAction>(null);

  // Reschedule form state
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Load appointments
  async function loadAppointments(tokenOverride?: string) {
    const token = tokenOverride || idToken;
    if (!token) {
      setLoading(false);
      setAppointments([]);
      setError("Please login first to view your appointments.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getAppointments(token);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setAppointments([]);
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  // Handle reschedule
  async function handleReschedule(e: FormEvent) {
    e.preventDefault();
    if (!selectedAppointment) return;
    if (!idToken) {
      setError("Please login first to reschedule appointments.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await rescheduleAppointment(selectedAppointment.id, {
        date: newDate,
        time: newTime,
        reason: rescheduleReason,
      }, idToken);
      setMessage("✓ Appointment rescheduled successfully");
      setSelectedAppointment(updated);
      setAction(null);
      setNewDate("");
      setNewTime("");
      setRescheduleReason("");
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setLoading(false);
    }
  }

  // Handle cancel
  async function handleCancel(id: string) {
    if (!idToken) {
      setError("Please login first to cancel appointments.");
      return;
    }
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await cancelAppointment(id, idToken);
      setMessage("✓ Appointment cancelled successfully");
      setSelectedAppointment(null);
      setAction(null);
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel appointment");
    } finally {
      setLoading(false);
    }
  }

  // Handle join consultation
  async function handleJoinConsultation(id: string) {
    if (!idToken) {
      setError("Please login first to join consultation.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await getConsultationToken(id, idToken);
      setMessage(`✓ Token generated: ${result.token.substring(0, 20)}...`);
      // In a real app, you would use this token to join a LiveKit room
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get consultation token");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayNow(apt: Appointment) {
    if (!idToken) {
      setError("Please login first to continue payment.");
      return;
    }

    setError(null);

    // Prefer list payload, then fetch detail as fallback.
    let checkoutUrl = apt.checkoutUrl || "";
    if (!checkoutUrl) {
      try {
        const detailed = await getAppointmentByID(apt.id, idToken);
        checkoutUrl = detailed.checkoutUrl || "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payment link");
        return;
      }
    }

    if (!checkoutUrl) {
      setError("No checkout link found for this appointment.");
      return;
    }

    if (!checkoutUrl.startsWith("https://checkout.stripe.com/")) {
      setError("Invalid checkout link. Please contact support.");
      return;
    }

    window.location.href = checkoutUrl;
  }

  async function handleConfirmPayment(id: string) {
    if (!idToken) {
      setError("Please login first to confirm payment.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await confirmAppointmentPayment(id, idToken);
      setMessage(result.message || "Payment confirmed.");
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm payment");
    } finally {
      setLoading(false);
    }
  }

  // Initialize
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIdToken(null);
        setAppointments([]);
        setLoading(false);
        setError("Please login first to view your appointments.");
        return;
      }

      const token = await user.getIdToken();
      setIdToken(token);
      await loadAppointments(token);
    });

    return () => unsubscribe();
  }, []);

  // Format date/time for display
  function formatDateTime(date: string, time: string) {
    try {
      const d = new Date(`${date}T${time}`);
      return d.toLocaleString();
    } catch {
      return `${date} at ${time}`;
    }
  }

  // Get status badge color
  function getStatusColor(status: string) {
    switch (status?.toUpperCase()) {
      case "PENDING_PAYMENT":
        return "text-yellow-600";
      case "CONFIRMED":
        return "text-blue-600";
      case "BOOKED":
        return "text-green-600";
      case "REJECTED":
        return "text-red-600";
      case "CANCELLED":
        return "text-gray-600";
      case "COMPLETED":
        return "text-emerald-700";
      default:
        return "text-slate-600";
    }
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="surface-card">
        <p className="section-kicker">Your appointments</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Appointment history</h2>
        <p className="mt-2 text-sm text-slate-600">View, reschedule, or manage your upcoming and past appointments.</p>
        <button
          className="btn-secondary mt-4"
          onClick={() => {
            void loadAppointments();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {/* Messages */}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      {/* Loading state */}
      {loading && appointments.length === 0 && (
        <p className="surface-card text-sm text-slate-600">Loading appointments...</p>
      )}

      {/* Empty state */}
      {!loading && appointments.length === 0 && (
        <div className="surface-card">
          <p className="text-sm text-slate-600">No appointments yet.</p>
          <p className="mt-2 text-xs text-slate-500">Book your first appointment to get started.</p>
        </div>
      )}

      {/* Appointments list */}
      {appointments.length > 0 && !selectedAppointment && (
        <div className="grid gap-3">
          {appointments.map((apt) => (
            <article key={apt.id} className="surface-card cursor-pointer transition hover:shadow-md" onClick={() => setSelectedAppointment(apt)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">Doctor: {apt.doctorId}</h3>
                  <p className="mt-1 text-sm text-slate-600">Patient: {apt.patientId}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateTime(apt.date, apt.time)}</p>
                  <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusColor(apt.status)}`}>
                    {apt.status}
                  </p>
                </div>
                <button
                  className="btn-secondary text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAppointment(apt);
                  }}
                >
                  Manage
                </button>
                {apt.status === "PENDING_PAYMENT" && (
                  <button
                    className="btn-primary ml-2 text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePayNow(apt);
                    }}
                  >
                    Pay now
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Appointment detail view */}
      {selectedAppointment && !action && (
        <div className="surface-card">
          <button
            className="btn-secondary text-sm mb-4"
            onClick={() => setSelectedAppointment(null)}
          >
            ← Back to list
          </button>

          <h3 className="text-lg font-semibold text-slate-900">Appointment Details</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p><strong>ID:</strong> {selectedAppointment.id}</p>
            <p><strong>Doctor:</strong> {selectedAppointment.doctorId}</p>
            <p><strong>Patient:</strong> {selectedAppointment.patientId}</p>
            <p><strong>Time:</strong> {formatDateTime(selectedAppointment.date, selectedAppointment.time)}</p>
            <p className={`font-semibold ${getStatusColor(selectedAppointment.status)}`}>
              Status: {selectedAppointment.status}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {selectedAppointment.status === "PENDING_PAYMENT" && (
              <>
                <button
                  className="btn-primary text-sm"
                  onClick={() => {
                    void handlePayNow(selectedAppointment);
                  }}
                  disabled={loading}
                >
                  Pay now
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => {
                    void handleConfirmPayment(selectedAppointment.id);
                  }}
                  disabled={loading}
                >
                  I have paid
                </button>
              </>
            )}
            {(selectedAppointment.status === "BOOKED") && (
              <>
                <button
                  className="btn-primary text-sm"
                  onClick={() => handleJoinConsultation(selectedAppointment.id)}
                  disabled={loading}
                >
                  Join consultation
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setAction("reschedule")}
                >
                  Reschedule
                </button>
              </>
            )}
            {["PENDING_PAYMENT", "CONFIRMED", "BOOKED"].includes(selectedAppointment.status) && (
              <button
                className="btn-secondary text-sm text-red-600"
                onClick={() => handleCancel(selectedAppointment.id)}
                disabled={loading}
              >
                Cancel appointment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reschedule form */}
      {selectedAppointment && action === "reschedule" && (
        <form onSubmit={handleReschedule} className="surface-card">
          <button
            type="button"
            className="btn-secondary text-sm mb-4"
            onClick={() => setAction(null)}
          >
            ← Back
          </button>

          <h3 className="text-lg font-semibold text-slate-900">Reschedule Appointment</h3>
          <p className="mt-2 text-sm text-slate-600">Select a new date and time for your appointment.</p>

          <div className="mt-5 grid gap-3">
            <input
              type="date"
              className="field-input"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
            <input
              type="time"
              className="field-input"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              step="900"
              required
            />
            <textarea
              className="field-input"
              placeholder="Reason for rescheduling (required)"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              required
              rows={3}
            />
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Rescheduling..." : "Confirm reschedule"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
