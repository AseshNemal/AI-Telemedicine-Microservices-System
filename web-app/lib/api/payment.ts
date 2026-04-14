import { resolveServiceBase } from "@/lib/api/baseUrls";

export type PaymentMethod = "CARD" | "MOBILE" | "BANK_TRANSFER";

export type PaymentRecord = {
  id?: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
  checkoutUrl?: string;
  providerId?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

export type CreatePaymentInput = {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
};

export type CreatePaymentResult = {
  id: string;
  status: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  createdAt: string;
};

export type VerifyPaymentResult = {
  message: string;
  sessionId: string;
  paymentStatus: string;
  status: string;
};

const paymentBase = resolveServiceBase(
  process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL,
  "",
);

export async function getPayment(transactionId: string, idToken: string): Promise<PaymentRecord | null> {
  const res = await fetch(`${paymentBase}/payments/${encodeURIComponent(transactionId)}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error((await safeMessage(res)) ?? `Failed to fetch payment (${res.status})`);
  }

  return res.json();
}

export async function createPayment(input: CreatePaymentInput, idToken: string): Promise<CreatePaymentResult> {
  const res = await fetch(`${paymentBase}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error((await safeMessage(res)) ?? `Failed to create payment (${res.status})`);
  }

  return res.json();
}

export async function verifyPayment(sessionId: string, idToken: string): Promise<VerifyPaymentResult> {
  const res = await fetch(`${paymentBase}/payments/verify?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    throw new Error((await safeMessage(res)) ?? `Failed to verify payment (${res.status})`);
  }

  return res.json();
}

async function safeMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    return body.error ?? body.message ?? null;
  } catch {
    return null;
  }
}
