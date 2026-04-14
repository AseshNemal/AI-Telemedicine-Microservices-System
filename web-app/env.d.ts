declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_AUTH_SERVICE_URL?: string;
      NEXT_PUBLIC_PATIENT_SERVICE_URL?: string;
      NEXT_PUBLIC_DOCTOR_SERVICE_URL?: string;
      NEXT_PUBLIC_APPOINTMENT_SERVICE_URL?: string;
      NEXT_PUBLIC_PAYMENT_SERVICE_URL?: string;
      NEXT_PUBLIC_SYMPTOM_SERVICE_URL?: string;
      NEXT_PUBLIC_TELEMEDICINE_SERVICE_URL?: string;
      NEXT_PUBLIC_STRIPE_PUBLIC_KEY?: string;
    }
  }
}

export {};
