import { resolveServiceBase } from "@/lib/api/baseUrls";

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  availability: string[];
  consultation_fee_cents?: number;
  experience_years?: number;
  verification_status?: string;
};

export type DoctorProfileUpdateRequest = Partial<{
  name: string;
  specialty: string;
  hospital: string;
  experience_years: number;
  consultation_fee_cents: number;
}>;

export type Appointment = {
  id: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  doctorId: string;
  doctorName?: string;
  specialty?: string;
  appointmentType?: "PHYSICAL" | "VIRTUAL";
  hospitalName?: string;
  date: string;
  time: string;
  status: string;
  paymentStatus?: string;
  transactionId?: string;
  checkoutUrl?: string;
  consultationRoomName?: string;
  patientMeetingLink?: string;
  doctorMeetingLink?: string;
  meetingLink?: string;
};

export type PatientProfile = {
  authUserId: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  address: string | null;
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null;
  allergies: string[];
  chronicConditions: string[];
};

export type MedicalReport = {
  _id: string;
  patientId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  description: string;
  uploadedAt: string;
};

export type PrescriptionMedicine = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

export type Prescription = {
  _id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  medicines: PrescriptionMedicine[];
  notes?: string;
  issuedAt: string;
};

export type MedicalHistoryEntry = {
  _id: string;
  patientId: string;
  diagnosis: string;
  treatment?: string;
  doctorId: string;
  consultationDate: string;
  notes?: string;
};

export type PaymentCreateRequest = {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  currency: string;
  paymentMethod: "CARD" | "MOBILE" | "BANK_TRANSFER";
};

export type PaymentCreateResponse = {
  id: string;
  status: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  createdAt: string;
};

export type PaymentVerifyResponse = {
  message: string;
  sessionId?: string;
  paymentStatus: string;
  status: string;
  appointmentId?: string;
  transactionId?: string;
};

export type DoctorAccountCreateRequest = {
  fullName: string;
  email: string;
  password: string;
  specialty: string;
  hospital: string;
  availability: string[];
};

export type TelemedicineCreateRoomRequest = {
  roomName: string;
  emptyTimeout?: number;
  maxParticipants?: number;
  metadata?: string;
};

export type TelemedicineCreateTokenRequest = {
  roomName: string;
  participantIdentity: string;
  participantName?: string;
  metadata?: string;
  ttlSeconds?: number;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
};

export type TelemedicineTokenResponse = {
  token: string;
  wsUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  expiresInSeconds: number;
};

export type TelemedicineRoomResponse = {
  name: string;
  sid: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: number;
  metadata: string;
};

// Availability slot returned from doctor-service GET /doctors/:id/availability
export type DoctorAvailability = {
  id: string;
  doctor_id: string;
  day_of_week: number; // 0=Sunday
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  appointment_type?: "PHYSICAL" | "VIRTUAL" | "BOTH";
  hospital?: string;
};

export type DoctorAvailabilitySlotInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  appointment_type: "PHYSICAL" | "VIRTUAL" | "BOTH";
  hospital?: string;
};

export type DoctorScheduleSummaryDate = {
  date: string;
  dayOfWeek: number;
  totalSlots: number;
  bookedCount: number;
  availableSlots: number;
};

export type DoctorScheduleSummarySlot = {
  time: string;
  bookedCount: number;
  available: boolean;
  appointmentType?: string;
  hospitalName?: string;
};

export type DoctorScheduleSummary = {
  doctorId: string;
  from: string;
  to: string;
  days: number;
  dates: DoctorScheduleSummaryDate[];
  slotsByDate: Record<string, DoctorScheduleSummarySlot[]>;
};

// Resolve each service base from explicit env vars when present.
// If a service URL is not configured, it falls back to the API gateway base.
const doctorBase = resolveServiceBase(process.env.NEXT_PUBLIC_DOCTOR_SERVICE_URL, "");
const appointmentBase = resolveServiceBase(process.env.NEXT_PUBLIC_APPOINTMENT_SERVICE_URL, "");
const authBase = resolveServiceBase(process.env.NEXT_PUBLIC_AUTH_SERVICE_URL, "/api/auth");
const patientBase = resolveServiceBase(process.env.NEXT_PUBLIC_PATIENT_SERVICE_URL, "/api/patients");
const paymentBase = resolveServiceBase(process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL, "");
const telemedicineBase = resolveServiceBase(process.env.NEXT_PUBLIC_TELEMEDICINE_SERVICE_URL, "");

export async function getDoctors(specialty?: string): Promise<Doctor[]> {
  const query = specialty ? `?specialty=${encodeURIComponent(specialty)}` : "";
  const res = await fetch(`${doctorBase}/doctors${query}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch doctors (${res.status})`);
  }
  return res.json();
}

export async function getDoctorAvailability(doctorId: string, idToken?: string): Promise<DoctorAvailability[]> {
  const headers: HeadersInit = {};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  const res = await fetch(`${doctorBase}/doctors/${encodeURIComponent(doctorId)}/availability`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to fetch availability (${res.status})`);
  }
  return res.json();
}

export async function updateDoctorAvailability(
  doctorId: string,
  slots: DoctorAvailabilitySlotInput[],
  idToken: string
): Promise<DoctorAvailability[]> {
  const res = await fetch(`${doctorBase}/doctors/${encodeURIComponent(doctorId)}/availability`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(slots),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to update doctor availability (${res.status})`);
  }

  return res.json();
}

export async function getMyDoctorProfile(idToken: string): Promise<Doctor> {
  const res = await fetch(`${doctorBase}/doctor/profile`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to fetch doctor profile (${res.status})`);
  }

  return res.json();
}

export async function initializeDoctorProfile(idToken: string): Promise<Doctor> {
  const res = await fetch(`${doctorBase}/doctor/profile/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to initialize doctor profile (${res.status})`);
  }

  return res.json();
}

export async function updateMyDoctorProfile(idToken: string, payload: DoctorProfileUpdateRequest): Promise<Doctor> {
  const res = await fetch(`${doctorBase}/doctor/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to update doctor profile (${res.status})`);
  }

  return res.json();
}

export async function getDoctorScheduleSummary(
  doctorId: string,
  idToken: string,
  options?: { from?: string; days?: number }
): Promise<DoctorScheduleSummary> {
  const params = new URLSearchParams();
  if (options?.from) params.set("from", options.from);
  if (typeof options?.days === "number") params.set("days", String(options.days));
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${appointmentBase}/doctors/${encodeURIComponent(doctorId)}/schedule-summary${query}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to fetch doctor schedule summary (${res.status})`);
  }

  return res.json();
}

export async function getAdminDoctors(
  idToken: string,
  verificationStatus?: "PENDING" | "VERIFIED" | "SUSPENDED"
): Promise<Doctor[]> {
  const query = verificationStatus ? `?verification_status=${encodeURIComponent(verificationStatus)}` : "";
  const res = await fetch(`${doctorBase}/admin/doctors${query}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to fetch admin doctors (${res.status})`);
  }

  return res.json();
}

export async function verifyDoctor(id: string, idToken: string): Promise<Doctor> {
  const res = await fetch(`${doctorBase}/admin/doctors/${encodeURIComponent(id)}/verify`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to verify doctor (${res.status})`);
  }

  return res.json();
}

export async function suspendDoctor(id: string, idToken: string): Promise<Doctor> {
  const res = await fetch(`${doctorBase}/admin/doctors/${encodeURIComponent(id)}/suspend`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to suspend doctor (${res.status})`);
  }

  return res.json();
}

export async function createAppointment(payload: {
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  doctorId: string;
  specialty: string;
  appointmentType: "PHYSICAL" | "VIRTUAL";
  hospitalName?: string;
  date: string;
  time: string;
}, idToken: string) {
  const res = await fetch(`${appointmentBase}/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create appointment (${res.status})`);
  }

  const data = await res.json();
  const appointment = data?.appointment ?? data;

  return {
    ...data,
    id: appointment?.id ?? data?.id,
    appointment,
    checkoutUrl: data?.checkoutUrl ?? appointment?.checkoutUrl ?? "",
  };
}

export async function getAppointments(idToken: string): Promise<Appointment[]> {
  const res = await fetch(`${appointmentBase}/appointments/my`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch appointments (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getAppointmentsForDoctor(doctorId: string, idToken: string): Promise<Appointment[]> {
  const res = await fetch(`${appointmentBase}/appointments/doctor/${encodeURIComponent(doctorId)}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch doctor appointments (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getAppointmentByID(id: string, idToken: string): Promise<Appointment> {
  const res = await fetch(`${appointmentBase}/appointments/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch appointment (${res.status})`);
  }
  return res.json();
}

export async function rescheduleAppointment(
  id: string,
  payload: { date: string; time: string; reason: string },
  idToken: string
): Promise<Appointment> {
  const res = await fetch(`${appointmentBase}/appointments/${encodeURIComponent(id)}/reschedule`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to reschedule appointment (${res.status})`);
  }

  return res.json();
}

export async function cancelAppointment(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${appointmentBase}/appointments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to cancel appointment (${res.status})`);
  }
}

export async function updateAppointmentStatus(
  id: string,
  payload: { status: "BOOKED" | "REJECTED" | "CANCELLED"; reason?: string },
  idToken: string
): Promise<Appointment> {
  const res = await fetch(`${appointmentBase}/appointments/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to update appointment status (${res.status})`);
  }

  return res.json();
}

/**
 * Doctor accepts a CONFIRMED appointment via the doctor-service.
 * The doctor-service verifies ownership, verification status, and forwards to appointment-service.
 */
export async function doctorAcceptAppointment(
  appointmentId: string,
  idToken: string
): Promise<{ message: string }> {
  const res = await fetch(`${doctorBase}/doctor/appointments/${encodeURIComponent(appointmentId)}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to accept appointment (${res.status})`);
  }

  return res.json();
}

/**
 * Doctor rejects a CONFIRMED appointment via the doctor-service.
 * Rejection triggers an automatic refund and patient notification.
 */
export async function doctorRejectAppointment(
  appointmentId: string,
  idToken: string,
  reason?: string
): Promise<{ message: string }> {
  const res = await fetch(`${doctorBase}/doctor/appointments/${encodeURIComponent(appointmentId)}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(reason ? { reason } : {}),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to reject appointment (${res.status})`);
  }

  return res.json();
}

export async function doctorStartConsultation(
  appointmentId: string,
  idToken: string
): Promise<{ id: string; appointment_id: string; doctor_id: string; patient_id: string; session_id: string; meeting_link: string; status: string }> {
  const res = await fetch(`${doctorBase}/doctor/appointments/${encodeURIComponent(appointmentId)}/consultation/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to start consultation (${res.status})`);
  }

  return res.json();
}

export async function doctorEndConsultation(
  appointmentId: string,
  idToken: string,
  payload: { notes?: string; prescription?: string; medications?: Array<{ name: string; dosage: string; duration: string }> } = {}
): Promise<{ id: string; appointment_id: string; doctor_id: string; patient_id: string; session_id: string; meeting_link: string; status: string }> {
  const res = await fetch(`${doctorBase}/doctor/appointments/${encodeURIComponent(appointmentId)}/consultation/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to end consultation (${res.status})`);
  }

  return res.json();
}

export async function getDoctorPatientReports(
  appointmentId: string,
  idToken: string
): Promise<{ success?: boolean; data?: MedicalReport[] } | MedicalReport[]> {
  const res = await fetch(`${doctorBase}/doctor/appointments/${encodeURIComponent(appointmentId)}/patient-reports`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to load patient reports (${res.status})`);
  }

  return res.json();
}

export async function getConsultationToken(id: string, idToken: string): Promise<{ token: string; wsUrl: string; roomName?: string }> {
  const res = await fetch(`${appointmentBase}/appointments/${encodeURIComponent(id)}/consultation-token`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to get consultation token (${res.status})`);
  }

  return res.json();
}

export async function confirmAppointmentPayment(
  id: string,
  idToken: string
): Promise<{ message: string; appointment: Appointment }> {
  const res = await fetch(`${appointmentBase}/appointments/${encodeURIComponent(id)}/confirm-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to confirm payment (${res.status})`);
  }

  return res.json();
}

export async function register(payload: {
  fullName: string;
  email: string;
  password: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
}) {
  const res = await fetch(`${authBase}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Register failed (${res.status})`);
  }

  return res.json();
}

export async function login(payload: { email: string; password: string }) {
  const res = await fetch(`${authBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Login failed (${res.status})`);
  }

  return res.json();
}

export async function getMe(idToken: string) {
  const res = await fetch(`${authBase}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to load profile (${res.status})`);
  }

  return res.json();
}

export async function getMyPatientProfile(idToken: string): Promise<{ success: boolean; data: PatientProfile }> {
  const res = await fetch(`${patientBase}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to load patient profile (${res.status})`);
  }

  return res.json();
}

export async function updateMyPatientProfile(
  idToken: string,
  payload: Partial<{
    phone: string | null;
    address: string | null;
    dob: string | null;
    gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null;
    allergies: string[];
    chronicConditions: string[];
  }>
): Promise<{ success: boolean; data: PatientProfile; message: string }> {
  const res = await fetch(`${patientBase}/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to update patient profile (${res.status})`);
  }

  return res.json();
}

export async function getMyMedicalReports(
  idToken: string
): Promise<{ success: boolean; data: MedicalReport[] }> {
  const res = await fetch(`${patientBase}/me/reports`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to load medical reports (${res.status})`);
  }

  return res.json();
}

export async function uploadMyMedicalReport(
  idToken: string,
  payload: { file: File; description?: string }
): Promise<{ success: boolean; data: MedicalReport; message: string }> {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.description) {
    formData.append("description", payload.description);
  }

  const res = await fetch(`${patientBase}/me/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to upload report (${res.status})`);
  }

  return res.json();
}

export async function deleteMyMedicalReport(idToken: string, reportId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${patientBase}/me/reports/${encodeURIComponent(reportId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to delete report (${res.status})`);
  }

  return res.json();
}

export async function getMyPrescriptions(
  idToken: string
): Promise<{ success: boolean; data: Prescription[] }> {
  const res = await fetch(`${patientBase}/me/prescriptions`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to load prescriptions (${res.status})`);
  }

  return res.json();
}

export async function getMyMedicalHistory(
  idToken: string
): Promise<{ success: boolean; data: MedicalHistoryEntry[] }> {
  const res = await fetch(`${patientBase}/me/history`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to load medical history (${res.status})`);
  }

  return res.json();
}

export async function createPayment(payload: PaymentCreateRequest, idToken: string): Promise<PaymentCreateResponse> {
  const res = await fetch(`${paymentBase}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create payment (${res.status})`);
  }

  return res.json();
}

export async function createDoctorAccount(payload: DoctorAccountCreateRequest) {
  // Step 1: Register the doctor in the auth service.
  const authResult = await register({
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    role: "DOCTOR",
  });

  const doctorId = authResult?.data?.uid || authResult?.uid || "";

  // Step 2: Sign in as the new doctor using a temporary secondary Firebase app
  // so the current client auth session is not replaced.
  const { initializeApp, deleteApp } = await import("firebase/app");
  const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
  const { getFirebaseAuth } = await import("@/app/lib/firebaseClient");
  const primaryAuth = getFirebaseAuth();
  const tempAppName = `doctor-account-${doctorId || Date.now()}`;
  const tempApp = initializeApp(primaryAuth.app.options, tempAppName);
  const tempAuth = getAuth(tempApp);

  let doctorToken = "";

  try {
    const credential = await signInWithEmailAndPassword(tempAuth, payload.email, payload.password);
    doctorToken = await credential.user.getIdToken();
  } finally {
    await tempAuth.signOut().catch(() => undefined);
    await deleteApp(tempApp).catch(() => undefined);
  }

  // Step 3: Create the doctor profile using the doctor's own token.
  const res = await fetch(`${doctorBase}/doctors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${doctorToken}`,
    },
    body: JSON.stringify({
      id: doctorId,
      name: payload.fullName,
      specialty: payload.specialty,
      hospital: payload.hospital,
      availability: payload.availability,
    }),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create doctor profile (${res.status})`);
  }

  return {
    auth: authResult,
    doctor: await res.json(),
  };
}

export async function verifyPayment(sessionId: string, idToken: string): Promise<PaymentVerifyResponse> {
  const res = await fetch(`${paymentBase}/payments/verify?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to verify payment (${res.status})`);
  }

  return res.json();
}

export async function createTelemedicineRoom(
  payload: TelemedicineCreateRoomRequest,
): Promise<TelemedicineRoomResponse> {
  const res = await fetch(`${telemedicineBase}/telemedicine/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create room (${res.status})`);
  }

  return res.json();
}

export async function createTelemedicineToken(
  payload: TelemedicineCreateTokenRequest,
): Promise<TelemedicineTokenResponse> {
  const res = await fetch(`${telemedicineBase}/telemedicine/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create token (${res.status})`);
  }

  return res.json();
}

async function safeMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    return body.error || body.message || null;
  } catch {
    return null;
  }
}
