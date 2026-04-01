export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  availability: string[];
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  doctorId: string;
  doctorName?: string;
  specialty?: string;
  date: string;
  time: string;
  status: string;
  paymentStatus?: string;
  transactionId?: string;
  checkoutUrl?: string;
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
  sessionId: string;
  paymentStatus: string;
  status: string;
};

const doctorBase =
  process.env.NEXT_PUBLIC_DOCTOR_SERVICE_URL ?? "http://localhost:8082";
const appointmentBase =
  process.env.NEXT_PUBLIC_APPOINTMENT_SERVICE_URL ?? "http://localhost:8083";
const authBase =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ?? "http://localhost:8081";
const patientBase =
  process.env.NEXT_PUBLIC_PATIENT_SERVICE_URL ?? "http://localhost:5002";
const paymentBase =
  process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL ?? "http://localhost:8085";

export async function getDoctors(specialty?: string): Promise<Doctor[]> {
  const query = specialty ? `?specialty=${encodeURIComponent(specialty)}` : "";
  const res = await fetch(`${doctorBase}/doctors${query}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch doctors (${res.status})`);
  }
  return res.json();
}

export async function createAppointment(payload: {
  patientName: string;
  patientEmail: string;
  doctorId: string;
  specialty: string;
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

  return res.json();
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
  return res.json();
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
  payload: { status: "ACCEPTED" | "REJECTED" | "CANCELLED" },
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

export async function getConsultationToken(id: string, idToken: string): Promise<{ token: string }> {
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
  const res = await fetch(`${patientBase}/api/patients/me`, {
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
  const res = await fetch(`${patientBase}/api/patients/me`, {
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

export async function createPayment(payload: PaymentCreateRequest): Promise<PaymentCreateResponse> {
  const res = await fetch(`${paymentBase}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create payment (${res.status})`);
  }

  return res.json();
}

export async function verifyPayment(sessionId: string): Promise<PaymentVerifyResponse> {
  const res = await fetch(`${paymentBase}/payments/verify?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to verify payment (${res.status})`);
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
