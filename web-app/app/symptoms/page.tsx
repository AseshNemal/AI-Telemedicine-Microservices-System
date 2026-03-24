import SymptomConsole from "@/app/components/SymptomConsole";

export default function SymptomsPage() {
  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">AI Triage</p>
        <h1 className="section-title">Symptom Assistant</h1>
        <p className="section-subtitle">
          Chat with <strong>AI-symptom-service</strong> to assess symptom risk level,
          detect emergency red flags, and guide the next question flow.
        </p>
      </section>

      <SymptomConsole />
    </main>
  );
}
