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
  doctorId: string;
  date: string;
  time: string;
  status: string;
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
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
}) {
  const res = await fetch(`${appointmentBase}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || `Failed to create appointment (${res.status})`);
  }

  return res.json();
}

export async function getAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${appointmentBase}/appointments`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch appointments (${res.status})`);
  }
  return res.json();
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  role: "Patient" | "Doctor" | "Admin";
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
