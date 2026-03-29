export type SymptomContext = {
  type?: string;
  duration?: string;
  severity?: string;
  painType?: string;
  location?: string;
  redFlags?: boolean;
};

export type SymptomChatRequest = {
  message: string;
  context: SymptomContext;
};

export type SymptomNextQuestion = {
  type: "single_choice" | "scale" | "yes_no" | "text";
  question: string;
  options?: string[];
};

export type SymptomChatResponse = {
  reply: string;
  riskLevel: "low" | "medium" | "high";
  emergency: boolean;
  collectedData: Required<SymptomContext>;
  nextQuestion: SymptomNextQuestion | null;
};

export async function chatSymptoms(
  payload: SymptomChatRequest,
): Promise<SymptomChatResponse> {
  const res = await fetch(`/api/symptoms/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error((await safeMessage(res)) ?? `Symptom chat failed (${res.status})`);
  }

  return res.json();
}

async function safeMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    return body.details ?? body.error ?? body.message ?? null;
  } catch {
    return null;
  }
}
