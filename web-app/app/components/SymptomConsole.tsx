"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { chatSymptoms, SymptomChatResponse } from "@/app/lib/symptomApi";

type ChatMode = "home" | "chat";
type FlowMode = "idle" | "premade" | "direct";

type SuggestedTopic = {
  id: string;
  label: string;
  emoji: string;
  seed: string;
  defaultType: string;
};

type PremadeQuestion = {
  id: "duration" | "severity" | "location" | "redFlags";
  question: string;
  options: string[];
};

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: SymptomChatResponse;
  quickOptions?: string[];
};

type AssessmentSection = {
  key: string;
  title: string;
  value: string;
};

const suggestedTopics: SuggestedTopic[] = [
  {
    id: "headache",
    label: "Headache",
    emoji: "🤕",
    seed: "I have a headache. Can you help me assess my symptoms?",
    defaultType: "headache",
  },
  {
    id: "fever",
    label: "Fever or chills",
    emoji: "🌡️",
    seed: "I have a fever. Can you help me assess my symptoms?",
    defaultType: "fever",
  },
  {
    id: "cough",
    label: "Cough or cold",
    emoji: "🤧",
    seed: "I have cough and cold symptoms. Can you help me assess my symptoms?",
    defaultType: "cough",
  },
  {
    id: "stomach",
    label: "Stomach or digestion",
    emoji: "🤢",
    seed: "I have stomach or digestion issues. Can you help me assess my symptoms?",
    defaultType: "stomach pain",
  },
  {
    id: "other",
    label: "Something else",
    emoji: "💬",
    seed: "I have symptoms and need a triage assessment.",
    defaultType: "symptom",
  },
];

const fallbackQuestionOptions: Array<{ hint: RegExp; options: string[] }> = [
  {
    hint: /how long|duration|when did/i,
    options: ["Today", "1–2 days ago", "3–5 days ago", "More than 5 days ago", "Not sure"],
  },
  {
    hint: /severity|how bad|pain scale|how severe/i,
    options: ["Mild", "Moderate", "Severe"],
  },
];

const maxDirectFollowUps = 3;

type SymptomConsoleProps = {
  onOpenVoice?: () => void;
};

export default function SymptomConsole({ onOpenVoice }: SymptomConsoleProps) {
  const [mode, setMode] = useState<ChatMode>("home");
  const [flowMode, setFlowMode] = useState<FlowMode>("idle");

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
  const [selectedTopic, setSelectedTopic] = useState<SuggestedTopic | null>(null);

  const [premadeQuestionIndex, setPremadeQuestionIndex] = useState(0);
  const [premadeAnswers, setPremadeAnswers] = useState<Record<string, string>>({});
  const [directFollowUpsAsked, setDirectFollowUpsAsked] = useState(0);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const premadeQuestions = useMemo<PremadeQuestion[]>(() => {
    if (!selectedTopic) return [];

    const locationOptionsByTopic: Record<string, string[]> = {
      headache: ["Forehead", "One side of head", "Back of head", "Whole head", "Not sure"],
      fever: ["Whole body", "Head and face", "Chest", "Stomach", "Not sure"],
      cough: ["Throat", "Chest", "Nose/sinuses", "Whole upper body", "Not sure"],
      stomach: ["Upper abdomen", "Lower abdomen", "Whole abdomen", "Side/back", "Not sure"],
      other: ["Head", "Chest", "Abdomen", "Back/limbs", "Multiple areas"],
    };

    const questions: PremadeQuestion[] = [
      {
        id: "duration",
        question: "How long have you had this symptom?",
        options: ["Today", "1–2 days ago", "3–5 days ago", "More than 5 days ago", "Not sure"],
      },
      {
        id: "severity",
        question: "How severe is it right now?",
        options: ["Mild", "Moderate", "Severe"],
      },
      {
        id: "location",
        question: "Where do you feel it most?",
        options: locationOptionsByTopic[selectedTopic.id] ?? locationOptionsByTopic.other,
      },
      {
        id: "redFlags",
        question: "Any danger signs (breathing trouble, confusion, chest pain, fainting, uncontrolled vomiting)?",
        options: ["Yes", "No", "Not sure"],
      },
    ];

    return questions;
  }, [selectedTopic]);

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

    setHistory((prev) => [
      ...prev,
      {
        id: `${Date.now()}-u`,
        role: "user",
        text: trimmed,
      },
    ]);
    setMessage("");

    try {
      const baseResponse = await chatSymptoms({
        message: trimmed,
        context: {
          type,
          duration,
          severity: normalizedSeverity || severity,
          painType,
          location,
          redFlags,
        },
      });

      let response = enrichResponse(baseResponse);

      if (flowMode === "direct" && response.nextQuestion) {
        const nextAsked = directFollowUpsAsked + 1;
        setDirectFollowUpsAsked(nextAsked);

        if (nextAsked >= maxDirectFollowUps) {
          const finalResponse = await chatSymptoms({
            message: [
              "You have reached the follow-up limit. Provide a COMPLETE final triage assessment based on collected information.",
              "Include: 1) What is likely happening, 2) Why it might be happening, 3) What TO do (recommendations), 4) What TO AVOID (contraindications), 5) Risk level, 6) Emergency status.",
              "Do not ask additional follow-up questions.",
            ].join(" "),
            context: response.collectedData,
          });
          response = {
            ...enrichResponse(finalResponse),
            nextQuestion: null,
          };
        }
      }

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

      if (chatScrollRef.current) {
        setTimeout(() => {
          chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
        }, 80);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze symptoms");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) return;

    if (flowMode === "premade" && premadeQuestionIndex < premadeQuestions.length) {
      await handlePremadeAnswer(message.trim());
      setMessage("");
      return;
    }

    if (flowMode !== "premade") {
      setFlowMode("direct");
      if (mode === "home") setDirectFollowUpsAsked(0);
    }

    await sendChatMessage(message);
  }

  function onSuggestedClick(topic: SuggestedTopic) {
    setSelectedTopic(topic);
    setShowIntake(true);
  }

  async function onContinueIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTopic) return;

    const profilePrefix = [
      age.trim() ? `Age ${age.trim()}` : "",
      gender.trim() ? `${gender.trim()}` : "",
      country.trim() ? `from ${country.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    setShowIntake(false);
    setMode("chat");
    setFlowMode("premade");
    setError(null);

    setType(selectedTopic.defaultType);
    setDuration("");
    setSeverity("");
    setPainType("");
    setLocation("");
    setRedFlags(false);

    setPremadeQuestionIndex(0);
    setPremadeAnswers({});
    setDirectFollowUpsAsked(0);

    const initial =
      profilePrefix.length > 0
        ? `${selectedTopic.seed} Patient profile: ${profilePrefix}.`
        : selectedTopic.seed;

    const firstQuestion = premadeQuestions[0];

    setHistory([
      {
        id: `${Date.now()}-intro-user`,
        role: "user",
        text: initial,
      },
      {
        id: `${Date.now()}-intro-assistant`,
        role: "assistant",
        text: firstQuestion?.question ?? "Let’s begin your symptom assessment.",
        quickOptions: firstQuestion?.options ?? [],
      },
    ]);
  }

  async function handlePremadeAnswer(answer: string) {
    if (!selectedTopic) return;

    const currentQuestion = premadeQuestions[premadeQuestionIndex];
    if (!currentQuestion) return;

    setHistory((prev) => [
      ...prev,
      {
        id: `${Date.now()}-premade-u`,
        role: "user",
        text: answer,
      },
    ]);

    const nextAnswers = {
      ...premadeAnswers,
      [currentQuestion.id]: answer,
    };
    setPremadeAnswers(nextAnswers);

    applyPremadeAnswerToState(currentQuestion.id, answer, {
      setDuration,
      setSeverity,
      setLocation,
      setRedFlags,
    });

    const nextIndex = premadeQuestionIndex + 1;
    setPremadeQuestionIndex(nextIndex);

    if (nextIndex < premadeQuestions.length) {
      const nextQuestion = premadeQuestions[nextIndex];
      setHistory((prev) => [
        ...prev,
        {
          id: `${Date.now()}-premade-a`,
          role: "assistant",
          text: nextQuestion.question,
          quickOptions: nextQuestion.options,
        },
      ]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile = [
        age.trim() ? `Age: ${age.trim()}` : "",
        gender.trim() ? `Gender: ${gender.trim()}` : "",
        country.trim() ? `Country: ${country.trim()}` : "",
      ]
        .filter(Boolean)
        .join("; ");

      const summaryMessage = [
        `Primary symptom: ${selectedTopic.label}.`,
        profile ? `Patient profile: ${profile}.` : "",
        `Premade answers: duration=${nextAnswers.duration ?? ""}, severity=${nextAnswers.severity ?? ""}, location=${nextAnswers.location ?? ""}, danger-signs=${nextAnswers.redFlags ?? ""}.`,
        "Provide a COMPLETE triage assessment with the following structure:",
        "1. WHAT IS LIKELY HAPPENING: Explain the possible condition(s) based on symptoms",
        "2. WHY IT MIGHT BE HAPPENING: List likely causes or triggers",
        "3. WHAT TO DO: Specific actionable recommendations (rest, hydration, OTC meds, when to contact doctor, etc.)",
        "4. WHAT TO AVOID: Contraindications and things to NOT do",
        "5. RISK LEVEL: State as 'Low', 'Medium', or 'High'",
        "6. EMERGENCY: State if immediate medical attention is needed (yes/no)",
        "Do not ask follow-up questions. Be direct, clear, and practical.",
      ]
        .filter(Boolean)
        .join(" ");

      const finalResponse = enrichResponse(
        await chatSymptoms({
          message: summaryMessage,
          context: {
            type: selectedTopic.defaultType,
            duration: nextAnswers.duration ?? duration,
            severity: normalizeSeverityInput(nextAnswers.severity ?? severity),
            painType,
            location: nextAnswers.location ?? location,
            redFlags: normalizeYesNo(nextAnswers.redFlags),
          },
        }),
      );

      const finalTimestamp = Date.now();
      setHistory((prev) => [
        ...prev,
        {
          id: `${finalTimestamp}-premade-final-a`,
          role: "assistant",
          text: finalResponse.reply,
          response: {
            ...finalResponse,
            nextQuestion: null,
          },
        },
      ]);

      setType(finalResponse.collectedData.type ?? selectedTopic.defaultType);
      setDuration(finalResponse.collectedData.duration ?? (nextAnswers.duration ?? duration));
      setSeverity(finalResponse.collectedData.severity ?? normalizeSeverityInput(nextAnswers.severity ?? severity));
      setPainType(finalResponse.collectedData.painType ?? painType);
      setLocation(finalResponse.collectedData.location ?? (nextAnswers.location ?? location));
      setRedFlags(Boolean(finalResponse.collectedData.redFlags || normalizeYesNo(nextAnswers.redFlags)));

      // Reset to allow follow-ups or new direct queries
      setPremadeQuestionIndex(0);
      setPremadeAnswers({});
      setFlowMode("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze symptoms");
    } finally {
      setLoading(false);
    }
  }

  function applyQuickAnswer(value: string, source: "ai" | "premade") {
    if (source === "premade") {
      void handlePremadeAnswer(value);
      return;
    }

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
          <p className="section-kicker">AI triage</p>
          <h2 className="mt-3 text-4xl font-bold text-slate-900">Your virtual symptom assistant</h2>
          <p className="mt-3 text-sm text-slate-600">
            Share your symptoms to begin a guided, adaptive assessment.
          </p>

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

          <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Suggested topics</p>
          <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
            {suggestedTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className="btn-secondary !rounded-full !px-4 !py-2 text-sm"
                onClick={() => onSuggestedClick(topic)}
              >
                <span className="mr-2">{topic.emoji}</span>
                {topic.label}
              </button>
            ))}
          </div>

          {onOpenVoice && (
            <div className="mt-5">
              <button
                type="button"
                onClick={onOpenVoice}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Use Voice Assistant
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>

        {showIntake && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <form onSubmit={onContinueIntake} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-800">Before we begin, tell us a bit about you.</h3>
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
                    setSelectedTopic(null);
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
            {(() => {
              const sections = splitAssessmentSections(item.text);
              const isStructuredAssessment = item.role === "assistant" && sections.length >= 4;

              return (
            <div className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  item.role === "user"
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                {isStructuredAssessment ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Triage assessment</p>
                    {sections.map((section) => (
                      <div key={`${item.id}-${section.key}`} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section.title}</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{section.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-line">{item.text}</p>
                )}
              </div>
            </div>
              );
            })()}

            {!!item.quickOptions?.length && (
              <div className="ml-1 max-w-[78%] rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Choose an option</p>
                <div className="mt-2 space-y-2">
                  {item.quickOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => applyQuickAnswer(opt, "premade")}
                    >
                      <span className="text-slate-400">◯</span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                        onClick={() => applyQuickAnswer(opt, "ai")}
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
          placeholder={
            flowMode === "premade" && premadeQuestionIndex < premadeQuestions.length
              ? "Answer the current question..."
              : "Continue the conversation..."
          }
        />
        <button type="submit" className="btn-primary h-10 px-4" disabled={loading || !message.trim()}>
          Send
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-card space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Assessment details</h3>
          <p className="text-xs text-slate-500">Update any field to improve symptom interpretation.</p>
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
            {flowMode === "direct" && (
              <p className="text-xs text-slate-500">
                Follow-up questions used: {Math.min(directFollowUpsAsked, maxDirectFollowUps)}/{maxDirectFollowUps}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}

function enrichResponse(response: SymptomChatResponse): SymptomChatResponse {
  return {
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
  };
}

function inferOptionsFromQuestion(question: string): string[] {
  for (const rule of fallbackQuestionOptions) {
    if (rule.hint.test(question)) {
      return rule.options;
    }
  }
  return [];
}

function applyPremadeAnswerToState(
  questionId: PremadeQuestion["id"],
  answer: string,
  setters: {
    setDuration: (v: string) => void;
    setSeverity: (v: string) => void;
    setLocation: (v: string) => void;
    setRedFlags: (v: boolean) => void;
  },
) {
  if (questionId === "duration") {
    setters.setDuration(answer);
    return;
  }

  if (questionId === "severity") {
    setters.setSeverity(normalizeSeverityInput(answer));
    return;
  }

  if (questionId === "location") {
    setters.setLocation(answer);
    return;
  }

  if (questionId === "redFlags") {
    setters.setRedFlags(normalizeYesNo(answer));
  }
}

function normalizeYesNo(value: string): boolean {
  return /^y(es)?$/i.test(value.trim());
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

function splitAssessmentSections(text: string): AssessmentSection[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const sectionRegex =
    /(What is likely happening|Why it might be happening|What to do|What to avoid|When to seek care|Risk level|Emergency):/gi;

  const markers = Array.from(cleaned.matchAll(sectionRegex));
  if (markers.length === 0) return [];

  const sections: AssessmentSection[] = [];

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const title = current[1];
    const from = (current.index ?? 0) + current[0].length;
    const to = next?.index ?? cleaned.length;
    const value = cleaned.slice(from, to).trim();

    if (!value) continue;

    sections.push({
      key: title.toLowerCase().replace(/\s+/g, "-"),
      title,
      value,
    });
  }

  return sections;
}
