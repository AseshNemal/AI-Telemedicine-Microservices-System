"use client";

import { FormEvent, useMemo, useState } from "react";
import { chatSymptoms, SymptomChatResponse } from "@/app/lib/symptomApi";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: SymptomChatResponse;
};

export default function SymptomConsole() {
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

  const latestAssistant = useMemo(
    () => [...history].reverse().find((item) => item.role === "assistant"),
    [history],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    const userItem: ChatItem = {
      id: `${Date.now()}-u`,
      role: "user",
      text: trimmed,
    };
    setHistory((prev) => [...prev, userItem]);

    try {
      const response = await chatSymptoms({
        message: trimmed,
        context: {
          type,
          duration,
          severity,
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
          response,
        },
      ]);

      setType(response.collectedData.type ?? type);
      setDuration(response.collectedData.duration ?? duration);
      setSeverity(response.collectedData.severity ?? severity);
      setPainType(response.collectedData.painType ?? painType);
      setLocation(response.collectedData.location ?? location);
      setRedFlags(Boolean(response.collectedData.redFlags));
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze symptoms");
    } finally {
      setLoading(false);
    }
  }

  const riskTone =
    latestAssistant?.response?.riskLevel === "high"
      ? "bg-red-50 text-red-700 border-red-200"
      : latestAssistant?.response?.riskLevel === "medium"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="surface-card space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Symptom Assistant Chat</h2>
        <p className="text-sm text-slate-600">
          Describe symptoms in natural language. The assistant will estimate risk,
          suggest next questions, and keep context in sync.
        </p>

        <div className="max-h-[420px] space-y-3 overflow-auto rounded-2xl border border-slate-200 p-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">
              Start with something like: “I have chest pain for 30 minutes with sweating.”
            </p>
          ) : (
            history.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  item.role === "user"
                    ? "ml-6 bg-slate-900 text-white"
                    : "mr-6 border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <p className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
                  {item.role === "user" ? "You" : "AI-symptom-service"}
                </p>
                <p>{item.text}</p>
              </article>
            ))
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            className="field-input h-28 w-full resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your symptom details..."
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Analyzing symptoms..." : "Send to assistant"}
          </button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      <aside className="space-y-4">
        <div className="surface-card space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Current Context</h3>
          <div className="grid grid-cols-1 gap-2">
            <input className="field-input" value={type} onChange={(e) => setType(e.target.value)} placeholder="Type (e.g. chest pain)" />
            <input className="field-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (e.g. 30 minutes)" />
            <input className="field-input" value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="Severity (mild / moderate / severe)" />
            <input className="field-input" value={painType} onChange={(e) => setPainType(e.target.value)} placeholder="Pain type (sharp, pressure, burning...)" />
            <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={redFlags}
                onChange={(e) => setRedFlags(e.target.checked)}
              />
              Red-flag signs present
            </label>
          </div>
        </div>

        {latestAssistant?.response && (
          <div className="surface-card space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Latest Triage Summary</h3>

            <p className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase ${riskTone}`}>
              Risk: {latestAssistant.response.riskLevel}
            </p>

            {latestAssistant.response.emergency && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Emergency signal detected. Seek immediate medical care now.
              </div>
            )}

            {latestAssistant.response.nextQuestion && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium">Next Question</p>
                <p className="mt-1">{latestAssistant.response.nextQuestion.question}</p>
                {latestAssistant.response.nextQuestion.options?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {latestAssistant.response.nextQuestion.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="btn-secondary !px-3 !py-1 text-xs"
                        onClick={() => setMessage(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}
