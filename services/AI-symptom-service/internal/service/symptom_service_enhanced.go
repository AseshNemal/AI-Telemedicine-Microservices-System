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

// buildCompletionReply summarizes the collected data
func buildCompletionReply(ctx model.SymptomContext) string {
	return fmt.Sprintf("Thanks for the detailed information about your %s (%s, %s severity, %s). Let me provide my assessment.",
		ctx.Type, ctx.Duration, ctx.Severity, ctx.Location)
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
		resp.Reply = buildCompletionReply(ctx)
		return resp
	}

	// Otherwise, ask the next question based on phase
	resp.NextQuestion = getNextQuestion(ctx, nextPhase)
	resp.Reply = buildQuestionReply(ctx, nextPhase)

	return resp
}
