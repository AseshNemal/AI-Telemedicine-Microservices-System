"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { chatSymptoms, SymptomChatResponse } from "@/app/lib/symptomApi";

type ChatMode = "home" | "chat";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: SymptomChatResponse;
};

const suggestedTopics = [
  { label: "Headache", emoji: "🤕", seed: "I have a headache. Can you help me assess my symptoms?" },
  { label: "Fever or chills", emoji: "🌡️", seed: "I have a fever. Can you help me assess my symptoms?" },
  { label: "Cough or cold", emoji: "🤧", seed: "I have cough and cold symptoms. Can you help me assess my symptoms?" },
  { label: "Stomach or digestion", emoji: "🤢", seed: "I have stomach or digestion issues. Can you help me assess my symptoms?" },
  { label: "Something else", emoji: "💬", seed: "I have symptoms and need a triage assessment." },
];

const fallbackQuestionOptions: Array<{ hint: RegExp; options: string[] }> = [
  {
    hint: /how long|duration|when did/i,
    options: ["Today", "1–2 days ago", "3–5 days ago", "More than 5 days ago", "Not sure"],
  },
  {
    hint: /severity|how bad|pain scale/i,
    options: ["Mild", "Moderate", "Severe"],
  },
];

export default function SymptomConsole() {
  const [mode, setMode] = useState<ChatMode>("home");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("");
  const [painType, setPainType] = useState("");
  const [location, setLocation] = useState("");
  const [redFlags, setRedFlags] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatItem[]>([]);

  const [showIntake, setShowIntake] = useState(false);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("United States");
  const [pendingSeedMessage, setPendingSeedMessage] = useState("");

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const latestAssistant = useMemo(
    () => [...history].reverse().find((item) => item.role === "assistant"),
    [history],
  );

  async function sendChatMessage(rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const normalizedSeverity = severity || normalizeSeverityInput(trimmed);
    if (normalizedSeverity && !severity) {
      setSeverity(normalizedSeverity);
    }

    setMode("chat");
    setLoading(true);
    setError(null);

    const userItem: ChatItem = {
      id: `${Date.now()}-u`,
      role: "user",
      text: trimmed,
    };
    setHistory((prev) => [...prev, userItem]);
    setMessage("");

    try {
      const selectedTopic = pendingSeedMessage || type;
      const response = await chatSymptoms({
        message: trimmed,
        context: {
          type: selectedTopic || type,
          duration,
          severity: normalizedSeverity || severity,
          painType,
          location,
          redFlags,
        },
      });

      setHistory((prev) => [
        ...prev,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          text: response.reply,
          response: {
            ...response,
            nextQuestion: response.nextQuestion
              ? {
                  ...response.nextQuestion,
                  options:
                    response.nextQuestion.options?.length
                      ? response.nextQuestion.options
                      : inferOptionsFromQuestion(response.nextQuestion.question),
                }
              : null,
          },
        },
      ]);

      setType(response.collectedData.type ?? type);
      setDuration(response.collectedData.duration ?? duration);
      setSeverity(response.collectedData.severity ?? severity);
      setPainType(response.collectedData.painType ?? painType);
      setLocation(response.collectedData.location ?? location);
      setRedFlags(Boolean(response.collectedData.redFlags));
      if (chatScrollRef.current) {
        setTimeout(() => {
          chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
        }, 80);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze symptoms");
    } finally {
      setLoading(false);
      setPendingSeedMessage("");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendChatMessage(message);
  }

  function onSuggestedClick(seed: string) {
    setPendingSeedMessage(seed);
    setShowIntake(true);
  }

  async function onContinueIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingSeedMessage) return;

    const profilePrefix = [
      age.trim() ? `Age ${age.trim()}` : "",
      gender.trim() ? `${gender.trim()}` : "",
      country.trim() ? `from ${country.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    setShowIntake(false);

    const initial =
      profilePrefix.length > 0
        ? `${pendingSeedMessage} Patient profile: ${profilePrefix}.`
        : pendingSeedMessage;

    if (!type && pendingSeedMessage) {
      if (/fever/i.test(pendingSeedMessage)) setType("fever");
      else if (/headache/i.test(pendingSeedMessage)) setType("headache");
      else if (/cough|cold/i.test(pendingSeedMessage)) setType("cough");
      else if (/stomach|digestion/i.test(pendingSeedMessage)) setType("stomach pain");
    }

    await sendChatMessage(initial);
  }

  function applyQuickAnswer(value: string) {
    if (/today|day|not sure/i.test(value)) {
      setDuration(value);
    }
    const quickSeverity = normalizeSeverityInput(value);
    if (quickSeverity) {
      setSeverity(quickSeverity);
    }
    void sendChatMessage(value);
  }

  const riskTone =
    latestAssistant?.response?.riskLevel === "high"
      ? "bg-red-50 text-red-700 border-red-200"
      : latestAssistant?.response?.riskLevel === "medium"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (mode === "home") {
    return (
      <section className="mx-auto max-w-3xl pt-6">
        <div className="surface-card rounded-[32px] border-slate-200/90 bg-white/90 p-8 text-center md:p-12">
          <p className="section-kicker">AI TRIAGE</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-900">I am Symptom Assistant your AI Doctor</h2>

          <form
            onSubmit={onSubmit}
            className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-2xl border border-cyan-200 bg-white p-2 shadow-sm"
          >
            <input
              className="h-12 w-full rounded-xl border-0 px-3 text-sm text-slate-700 outline-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your symptoms or ask a health question..."
            />
            <button type="submit" className="btn-primary h-10 px-4" disabled={loading || !message.trim()}>
              {loading ? "..." : "➤"}
            </button>
          </form>

          <p className="mt-4 text-xs font-medium text-slate-500">SUGGESTED FOR YOU</p>
          <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
            {suggestedTopics.map((topic) => (
              <button
                key={topic.label}
                type="button"
                className="btn-secondary !rounded-full !px-4 !py-2 text-sm"
                onClick={() => onSuggestedClick(topic.seed)}
              >
                <span className="mr-2">{topic.emoji}</span>
                {topic.label}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>

        {showIntake && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <form onSubmit={onContinueIntake} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-800">Please enter your age, gender and country.</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Age</label>
                  <input
                    className="field-input w-full"
                    type="number"
                    min={0}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 36"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Gender</label>
                  <select
                    className="field-input w-full"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Country</label>
                  <input
                    className="field-input w-full"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                    required
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowIntake(false);
                    setPendingSeedMessage("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Continue</button>
              </div>
            </form>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-4xl gap-6">
      <div ref={chatScrollRef} className="max-h-[66vh] space-y-4 overflow-auto rounded-3xl border border-slate-200 bg-white/90 p-4 md:p-6">
        {history.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  item.role === "user"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                {item.text}
              </div>
            </div>

            {item.role === "assistant" && item.response?.nextQuestion && (
              <div className="ml-1 max-w-[78%] rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-800">{item.response.nextQuestion.question}</p>
                {!!item.response.nextQuestion.options?.length && (
                  <div className="mt-3 space-y-2">
                    {item.response.nextQuestion.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
                        onClick={() => applyQuickAnswer(opt)}
                      >
                        <span className="text-slate-400">◯</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" />
            Reviewing your symptoms...
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <input
          className="h-11 w-full rounded-xl border-0 px-3 text-sm text-slate-700 outline-none"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Continue the conversation..."
        />
        <button type="submit" className="btn-primary h-10 px-4" disabled={loading || !message.trim()}>
          Send
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-card space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Current context</h3>
          <div className="grid grid-cols-1 gap-2">
            <input className="field-input" value={type} onChange={(e) => setType(e.target.value)} placeholder="Symptom type" />
            <input className="field-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration" />
            <input className="field-input" value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="Severity" />
            <input className="field-input" value={painType} onChange={(e) => setPainType(e.target.value)} placeholder="Pain type" />
            <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={redFlags} onChange={(e) => setRedFlags(e.target.checked)} />
              Red-flag signs present
            </label>
          </div>
        </div>

        {latestAssistant?.response && (
          <div className="surface-card space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Latest triage summary</h3>
            <p className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase ${riskTone}`}>
              Risk: {latestAssistant.response.riskLevel}
            </p>
            {latestAssistant.response.emergency && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Emergency signal detected. Seek immediate medical care now.
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}

function inferOptionsFromQuestion(question: string): string[] {
  for (const rule of fallbackQuestionOptions) {
    if (rule.hint.test(question)) {
      return rule.options;
    }
  }
  return [];
}

function normalizeSeverityInput(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";

  if (v.includes("mild")) return "mild";
  if (v.includes("moderate")) return "moderate";
  if (v.includes("severe")) return "severe";

  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n >= 1 && n <= 3) return "mild";
    if (n >= 4 && n <= 7) return "moderate";
    if (n >= 8 && n <= 10) return "severe";
  }

  return "";
}
