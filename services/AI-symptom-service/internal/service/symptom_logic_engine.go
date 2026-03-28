package service

import (
	"fmt"
	"strconv"
	"strings"

	"AI-symptom-service/internal/model"
)

// inferSymptomType extracts symptom type from user message
func inferSymptomType(message string) string {
	switch {
	case strings.Contains(message, "head") || strings.Contains(message, "migraine"):
		return "headache"
	case strings.Contains(message, "fever") || strings.Contains(message, "chills"):
		return "fever"
	case strings.Contains(message, "cough"):
		return "cough"
	case strings.Contains(message, "stomach") || strings.Contains(message, "abdomen"):
		return "stomach pain"
	case strings.Contains(message, "sore throat"):
		return "sore throat"
	case strings.Contains(message, "chest"):
		return "chest pain"
	default:
		return ""
	}
}

// inferDuration extracts how long the symptom has been present
func inferDuration(message string) string {
	switch {
	case strings.Contains(message, "today"):
		return "Today"
	case strings.Contains(message, "overnight"):
		return "1-2 days ago"
	case (strings.Contains(message, "1") && strings.Contains(message, "day")) ||
		(strings.Contains(message, "2") && strings.Contains(message, "day")):
		return "1-2 days ago"
	case (strings.Contains(message, "3") && strings.Contains(message, "day")) ||
		(strings.Contains(message, "5") && strings.Contains(message, "day")):
		return "3-5 days ago"
	case strings.Contains(message, "week"):
		return "More than 5 days ago"
	default:
		return ""
	}
}

// inferSeverity extracts severity level
func inferSeverity(message string) string {
	switch {
	case strings.Contains(message, "mild"):
		return "mild"
	case strings.Contains(message, "moderate"):
		return "moderate"
	case strings.Contains(message, "severe") || strings.Contains(message, "unbearable"):
		return "severe"
	default:
		if n, err := strconv.Atoi(strings.TrimSpace(message)); err == nil {
			switch {
			case n >= 1 && n <= 3:
				return "mild"
			case n >= 4 && n <= 7:
				return "moderate"
			case n >= 8 && n <= 10:
				return "severe"
			}
		}
		return ""
	}
}

// getNextQuestion formulates the next question to ask based on assessment phase
func getNextQuestion(ctx model.SymptomContext, phase string) *model.NextQuestion {
	switch phase {
	case model.PhaseSymptomType:
		return &model.NextQuestion{
			Type:     "text",
			Question: "What is your main symptom right now?",
			Options:  []string{},
		}

	case model.PhaseDuration:
		return &model.NextQuestion{
			Type:     "single_choice",
			Question: "How long have you had this symptom?",
			Options:  []string{"Today", "1-2 days ago", "3-5 days ago", "More than 5 days ago", "Not sure"},
		}

	case model.PhaseSeverity:
		return &model.NextQuestion{
			Type:     "single_choice",
			Question: "How severe is your symptom on a scale?",
			Options:  []string{"Mild", "Moderate", "Severe"},
		}

	case model.PhaseLocation:
		if strings.ToLower(ctx.Type) == "headache" {
			return &model.NextQuestion{
				Type:     "single_choice",
				Question: "Where is the headache located?",
				Options:  []string{"Front", "Back", "Side (left or right)", "All over", "Not sure"},
			}
		}
		return &model.NextQuestion{
			Type:     "text",
			Question: "What body area is affected?",
			Options:  []string{},
		}

	case model.PhaseContextSpecific:
		return getContextSpecificQuestion(ctx)

	default:
		return nil
	}
}

// getContextSpecificQuestion returns symptom-specific follow-up questions
func getContextSpecificQuestion(ctx model.SymptomContext) *model.NextQuestion {
	switch strings.ToLower(ctx.Type) {
	case "fever":
		if ctx.Temperature == "" {
			return &model.NextQuestion{
				Type:     "single_choice",
				Question: "What was your highest measured temperature?",
				Options:  []string{"I haven't measured it", "Less than 100.4F (38C)", "100.4-102.2F (38-39C)", "102.2-104F (39-40C)", "Higher than 104F (40C)"},
			}
		}
		if ctx.RecentTravel == "" {
			return &model.NextQuestion{
				Type:     "single_choice",
				Question: "Have you traveled outside your region in the past 2 weeks?",
				Options:  []string{"Yes", "No", "Not sure"},
			}
		}

	case "headache":
		if ctx.Vision == "" {
			return &model.NextQuestion{
				Type:     "single_choice",
				Question: "Do you have any vision changes (blurred vision, light sensitivity)?",
				Options:  []string{"Yes", "No", "Slightly"},
			}
		}
	}

	return nil
}

// buildQuestionReply creates a conversational reply for the question phase
func buildQuestionReply(ctx model.SymptomContext, phase string) string {
	switch phase {
	case model.PhaseSymptomType:
		return "Let's start with your main symptom. Please tell me what you're experiencing."
	case model.PhaseDuration:
		return fmt.Sprintf("Got it. You're experiencing a %s. When did this start?", ctx.Type)
	case model.PhaseSeverity:
		return "I see. On a severity scale, how would you describe this symptom?"
	case model.PhaseLocation:
		return "Where exactly are you feeling this symptom?"
	case model.PhaseContextSpecific:
		if strings.ToLower(ctx.Type) == "fever" {
			return "Let me ask a few more details to assess your fever properly."
		}
		if strings.ToLower(ctx.Type) == "headache" {
			return "I have a few more questions to understand your headache better."
		}
		return "I'd like to gather a bit more detail."
	default:
		return "Continuing your assessment..."
	}
}

// buildCompletionReply returns a structured final assessment for deterministic flow.
func buildCompletionReply(ctx model.SymptomContext, steps *model.NextSteps) string {
	symptomSummary := inferSymptomSummary(ctx)
	causeSummary := inferLikelyCause(ctx)

	risk := "Medium"
	emergency := false
	if ctx.RedFlags {
		risk = "High"
		emergency = true
	} else if steps != nil {
		switch strings.ToLower(strings.TrimSpace(steps.Urgency)) {
		case "routine":
			risk = "Low"
		case "soon":
			risk = "Medium"
		case "emergency":
			risk = "High"
			emergency = true
		}
	}

	whenSeek := "Seek care promptly if symptoms worsen or new warning signs appear."
	if steps != nil && strings.TrimSpace(steps.WhenToSeekCare) != "" {
		whenSeek = strings.TrimSpace(steps.WhenToSeekCare)
	}

	lines := []string{
		"🩺 Quick Health Check",
		"",
		"Based on what you’ve shared, " + symptomSummary,
		"",
		"💡 What might be causing this?",
		causeSummary,
		"",
		"✅ What you can do right now:",
	}

	for _, item := range inferWhatToDoItems(ctx, steps) {
		lines = append(lines, "• "+item)
	}

	lines = append(lines, "", "⚠️ What to avoid:")
	for _, item := range inferWhatToAvoidItems(ctx) {
		lines = append(lines, "• "+item)
	}

	lines = append(lines,
		"",
		"🚨 When to seek medical help:",
		whenSeek,
		"",
		fmt.Sprintf("🔴 Risk level: %s", risk),
	)

	if emergency || strings.EqualFold(risk, "High") {
		lines = append(lines, "🚑 This may require urgent care — it’s best to see a doctor as soon as possible.")
	} else if strings.EqualFold(risk, "Medium") {
		lines = append(lines, "🚑 Please arrange medical review soon if symptoms persist or get worse.")
	} else {
		lines = append(lines, "🟢 This appears lower risk right now; continue home care and monitoring.")
	}

	return strings.Join(lines, "\n")
}

func inferSymptomSummary(ctx model.SymptomContext) string {
	symptom := strings.TrimSpace(ctx.Type)
	if symptom == "" {
		symptom = "your symptoms"
	}

	severity := strings.TrimSpace(ctx.Severity)
	if severity == "" {
		severity = "unspecified"
	}

	location := strings.TrimSpace(ctx.Location)
	if location == "" {
		return fmt.Sprintf("your symptoms look like a %s pattern with %s intensity.", symptom, severity)
	}

	return fmt.Sprintf("your symptoms look like a %s pattern (%s severity) affecting %s.", symptom, severity, location)
}

func inferWhatToDoItems(ctx model.SymptomContext, steps *model.NextSteps) []string {
	switch strings.ToLower(strings.TrimSpace(ctx.Type)) {
	case "fever":
		return []string{
			"Get plenty of rest",
			"Drink lots of fluids",
			"Eat light, easy-to-digest meals",
			"Use a cool compress if you feel too warm",
			"Check your temperature every 4 hours",
		}
	case "headache":
		return []string{
			"Rest in a quiet and dim room",
			"Hydrate well through the day",
			"Use prescribed or over-the-counter pain relief as directed",
			"Limit screen time and eye strain",
			"Track symptom changes over the next 24 hours",
		}
	case "cough", "cold", "cough and cold":
		return []string{
			"Stay hydrated with warm fluids",
			"Use throat soothing measures like honey or lozenges",
			"Get adequate rest",
			"Avoid smoke and environmental irritants",
			"Monitor for breathing changes or persistent fever",
		}
	case "stomach pain", "abdomen", "abdominal pain":
		return []string{
			"Take clear fluids and rest",
			"Choose bland foods in small portions",
			"Avoid spicy or fatty meals",
			"Monitor pain pattern and hydration",
			"Seek early review if pain increases",
		}
	default:
		if steps != nil && strings.TrimSpace(steps.MedicalRecommendation) != "" {
			return []string{strings.TrimSpace(steps.MedicalRecommendation)}
		}
		return []string{
			"Rest and stay hydrated",
			"Monitor symptom progression",
			"Use medicines only as directed",
			"Seek medical review if worsening",
		}
	}
}

func inferWhatToAvoidItems(ctx model.SymptomContext) []string {
	switch strings.ToLower(strings.TrimSpace(ctx.Type)) {
	case "fever":
		return []string{
			"Don’t let yourself get dehydrated",
			"Avoid alcohol",
			"Don’t take more than the recommended dose of fever medicine",
			"Don’t ignore symptoms if they get worse",
		}
	case "headache":
		return []string{
			"Avoid sleep deprivation",
			"Avoid excessive screen exposure",
			"Avoid overusing painkillers",
			"Do not ignore sudden severe or unusual headache",
		}
	case "cough", "cold", "cough and cold":
		return []string{
			"Avoid smoking and secondhand smoke",
			"Avoid unnecessary antibiotics without medical advice",
			"Avoid dehydration",
			"Do not ignore breathing difficulty",
		}
	case "stomach pain", "abdomen", "abdominal pain":
		return []string{
			"Avoid spicy, oily, or heavy foods",
			"Avoid NSAID overuse on an empty stomach",
			"Avoid delaying care if pain worsens",
			"Avoid self-medicating repeatedly without review",
		}
	default:
		return []string{
			"Avoid self-medicating aggressively",
			"Avoid delaying care if symptoms worsen",
		}
	}
}

func inferLikelyCause(ctx model.SymptomContext) string {
	switch strings.ToLower(strings.TrimSpace(ctx.Type)) {
	case "fever":
		return "Common causes include viral infections, mild bacterial illness, dehydration, or inflammatory responses."
	case "headache":
		return "Common causes include tension, migraine triggers, dehydration, poor sleep, eye strain, or stress."
	case "cough", "cold", "cough and cold":
		return "Common causes include upper respiratory viral infection, throat irritation, post-nasal drip, or allergy-related inflammation."
	case "stomach pain", "abdomen", "abdominal pain":
		return "Common causes include gastritis, indigestion, viral gastroenteritis, food intolerance, or bowel irritation."
	default:
		return "It may be due to a self-limited infection, inflammation, stress-related factors, or another non-emergency condition."
	}
}

func inferWhatToAvoid(ctx model.SymptomContext) string {
	switch strings.ToLower(strings.TrimSpace(ctx.Type)) {
	case "fever":
		return "Avoid dehydration, alcohol, overdosing fever medicines, and ignoring persistent high fever or confusion."
	case "headache":
		return "Avoid excessive screen strain, sleep deprivation, skipping meals, and overusing painkillers repeatedly."
	case "cough", "cold", "cough and cold":
		return "Avoid smoking, dusty/irritant exposure, self-starting antibiotics, and suppressing severe persistent cough without evaluation."
	case "stomach pain", "abdomen", "abdominal pain":
		return "Avoid spicy/fatty foods, excess NSAID painkillers on an empty stomach, and delaying care for worsening pain."
	default:
		return "Avoid self-medicating aggressively or delaying care if symptoms are worsening or persistent."
	}
}

// generateNextStepsSummary creates a detailed summary with medical recommendations
func generateNextStepsSummary(ctx model.SymptomContext) *model.NextSteps {
	steps := &model.NextSteps{
		Urgency: "routine",
	}

	symptomLower := strings.ToLower(ctx.Type)
	severityLower := strings.ToLower(ctx.Severity)

	switch symptomLower {
	case "fever":
		if severityLower == "severe" {
			steps.Urgency = "soon"
			steps.MedicalRecommendation = "High fever (>102.2F / 39C) warrants urgent evaluation. Consider visiting clinic or urgent care today."
		} else {
			steps.MedicalRecommendation = "For fever: Rest, stay hydrated, light meals, cool compresses. Monitor temperature every 4 hours."
		}
		steps.RiskMonitoring = "Watch for: severe headache, stiff neck, confusion, difficulty breathing, or persistent high fever >3 days."
		steps.WhenToSeekCare = "Seek immediate care if: temperature stays >103F (39.4C), you develop confusion/stiff neck, difficulty breathing, or if symptoms worsen."
		if strings.Contains(ctx.RecentTravel, "Yes") {
			steps.SpecialistReferral = "Consider infectious disease consultation if recent travel to high-risk region."
		}

	case "headache":
		if severityLower == "severe" {
			steps.Urgency = "soon"
			steps.MedicalRecommendation = "Severe headache requires evaluation. Visit urgent care or doctor today, especially with vision changes or other symptoms."
		} else {
			steps.MedicalRecommendation = "For headache: Rest in quiet, dark area. Hydrate, try over-the-counter acetaminophen or ibuprofen as directed."
		}
		steps.RiskMonitoring = "Watch for: worst headache ever, vision changes, confusion, weakness, or fever accompanying the headache."
		steps.WhenToSeekCare = "Seek immediate care if: worst headache of your life, vision loss, weakness, confusion, or fever develops."
		if strings.Contains(strings.ToLower(ctx.Vision), "yes") || strings.Contains(strings.ToLower(ctx.Vision), "blur") {
			steps.SpecialistReferral = "Vision changes warrant eye doctor evaluation if persistent."
		}

	case "cough":
		if severityLower == "severe" {
			steps.Urgency = "soon"
			steps.MedicalRecommendation = "Severe cough warrants medical evaluation. Visit clinic today to rule out serious causes."
		} else {
			steps.MedicalRecommendation = "For cough: Honey/cough drops, hydration, rest. Avoid irritants. Monitor for worsening."
		}
		steps.RiskMonitoring = "Watch for: coughing blood, difficulty breathing, chest pain, green/yellow sputum, or fever."
		steps.WhenToSeekCare = "Seek care if: cough persists >2 weeks, you bring up blood, develop difficulty breathing, or have high fever."

	case "stomach pain":
		if severityLower == "severe" {
			steps.Urgency = "soon"
			steps.MedicalRecommendation = "Severe abdominal pain requires evaluation. Visit urgent care or ER today."
		} else {
			steps.MedicalRecommendation = "For stomach pain: Rest, light diet (clear fluids, bland foods), avoid spicy/fatty foods. Monitor symptoms."
		}
		steps.RiskMonitoring = "Watch for: severe or worsening pain, vomiting blood, fever >101.5F, inability to eat/drink."
		steps.WhenToSeekCare = "Seek immediate care if: severe pain, fever with pain, persistent vomiting, or abdominal swelling."

	default:
		steps.MedicalRecommendation = "Monitor your symptoms closely and follow general wellness advice: rest, hydration, nutrition."
		steps.WhenToSeekCare = "Seek care if symptoms worsen or new symptoms develop."
	}

	// Risk level assignment
	if severityLower == "severe" {
		steps.Urgency = "soon"
	} else if severityLower == "moderate" {
		steps.Urgency = "soon"
	}

	return steps
}

// updateAdaptiveQuestionFlow implements the adaptive question flow
func updateAdaptiveQuestionFlow(req model.SymptomChatRequest) model.SymptomChatResponse {
	ctx := req.Context
	message := strings.ToLower(strings.TrimSpace(req.Message))

	// Check for emergency red flags first
	if strings.Contains(message, "confusion") || strings.Contains(message, "faint") ||
		strings.Contains(message, "loss of consciousness") || strings.Contains(message, "weakness") ||
		strings.Contains(message, "speech") || strings.Contains(message, "worst headache") ||
		strings.Contains(message, "chest pain") || strings.Contains(message, "difficulty breathing") ||
		strings.Contains(message, "seizure") {
		ctx.RedFlags = true
		return model.SymptomChatResponse{
			Reply:         "You are reporting emergency warning signs. Please call emergency services (911) or go to the nearest emergency room immediately.",
			RiskLevel:     "high",
			Emergency:     true,
			CollectedData: ctx,
			NextQuestion:  nil,
		}
	}

	// Extract symptom type from message
	if ctx.Type == "" {
		ctx.Type = inferSymptomType(message)
	}

	// Extract duration
	if ctx.Duration == "" {
		ctx.Duration = inferDuration(message)
	}

	// Extract severity
	if ctx.Severity == "" {
		ctx.Severity = inferSeverity(message)
	}

	// Determine next phase
	nextPhase := ctx.DetermineNextPhase()

	resp := model.SymptomChatResponse{
		Reply:         "",
		RiskLevel:     "medium",
		Emergency:     false,
		CollectedData: ctx,
		NextQuestion:  nil,
	}

	// If complete, generate summary with next steps
	if nextPhase == model.PhaseComplete {
		resp.NextQuestion = nil
		resp.NextSteps = generateNextStepsSummary(ctx)
		resp.Reply = buildCompletionReply(ctx, resp.NextSteps)
		return resp
	}

	// Otherwise, ask the next question based on phase
	resp.NextQuestion = getNextQuestion(ctx, nextPhase)
	resp.Reply = buildQuestionReply(ctx, nextPhase)

	return resp
}
