package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"AI-symptom-service/internal/ai"
	"AI-symptom-service/internal/model"
)

type SymptomService struct {
	aiClient *ai.OpenAIClient
}

func NewSymptomService(aiClient *ai.OpenAIClient) *SymptomService {
	return &SymptomService{aiClient: aiClient}
}

func (s *SymptomService) Chat(ctx context.Context, req model.SymptomChatRequest) (model.SymptomChatResponse, error) {
	if strings.TrimSpace(req.Message) == "" {
		return model.SymptomChatResponse{}, errors.New("message is required")
	}

	// Minimum API-call mode:
	// For common guided symptom flows, use deterministic adaptive flow directly
	// so we don't call AI on every short answer and risk repetitive loops.
	if shouldUseDeterministicFlow(req) {
		return updateAdaptiveQuestionFlow(req), nil
	}

	raw, err := s.aiClient.Chat(ctx, req, "")
	if err != nil {
		return updateAdaptiveQuestionFlow(req), nil
	}

	parsed, err := parseAndValidate(raw)
	if err != nil {
		// Retry once for invalid JSON/shape
		rawRetry, retryErr := s.aiClient.Chat(ctx, req, "Your previous answer was invalid. Return strict JSON only, exactly following the schema.")
		if retryErr != nil {
			return updateAdaptiveQuestionFlow(req), nil
		}

		parsed, err = parseAndValidate(rawRetry)
		if err != nil {
			return updateAdaptiveQuestionFlow(req), nil
		}
	}

	parsed.CollectedData = req.Context.Merge(parsed.CollectedData)
	parsed.CollectedData = normalizeContextFromMessage(parsed.CollectedData, req.Message)
	parsed.RiskLevel = model.NormalizeRiskLevel(parsed.RiskLevel)

	if parsed.CollectedData.RedFlags || parsed.RiskLevel == "high" {
		parsed.Emergency = true
		parsed.NextQuestion = nil
	}

	if parsed.Emergency {
		parsed.NextQuestion = nil
	}

	// If AI returns an incomplete turn (no next question and no next steps),
	// continue the deterministic adaptive flow based on collected context.
	if !parsed.Emergency && parsed.NextQuestion == nil && parsed.NextSteps == nil {
		fallbackReq := req
		fallbackReq.Context = parsed.CollectedData
		return updateAdaptiveQuestionFlow(fallbackReq), nil
	}

	// If AI asks a phase that's already answered, continue deterministic flow
	// instead of repeating the same question to the user.
	if !parsed.Emergency && parsed.NextQuestion != nil {
		q := strings.ToLower(strings.TrimSpace(parsed.NextQuestion.Question))
		if parsed.CollectedData.Type != "" && (strings.Contains(q, "main symptom") || strings.Contains(q, "what symptom")) {
			fallbackReq := req
			fallbackReq.Context = parsed.CollectedData
			return updateAdaptiveQuestionFlow(fallbackReq), nil
		}
		if parsed.CollectedData.Duration != "" && (strings.Contains(q, "how long") || strings.Contains(q, "duration") || strings.Contains(q, "when did")) {
			fallbackReq := req
			fallbackReq.Context = parsed.CollectedData
			return updateAdaptiveQuestionFlow(fallbackReq), nil
		}
		if parsed.CollectedData.Severity != "" && (strings.Contains(q, "severity") || strings.Contains(q, "scale") || strings.Contains(q, "how severe")) {
			fallbackReq := req
			fallbackReq.Context = parsed.CollectedData
			return updateAdaptiveQuestionFlow(fallbackReq), nil
		}
		if parsed.CollectedData.Location != "" && (strings.Contains(q, "where") || strings.Contains(q, "location") || strings.Contains(q, "body area")) {
			fallbackReq := req
			fallbackReq.Context = parsed.CollectedData
			return updateAdaptiveQuestionFlow(fallbackReq), nil
		}
	}

	if strings.TrimSpace(parsed.Reply) == "" {
		return updateAdaptiveQuestionFlow(req), nil
	}

	return parsed, nil
}

func shouldUseDeterministicFlow(req model.SymptomChatRequest) bool {
	msg := strings.ToLower(strings.TrimSpace(req.Message))
	t := strings.ToLower(strings.TrimSpace(req.Context.Type))

	// If flow already started with a known type, continue deterministically.
	switch t {
	case "headache", "fever", "cough", "stomach pain", "cold", "cough and cold":
		return true
	}

	// Start deterministic flow immediately for known symptom intents.
	if strings.Contains(msg, "headache") || strings.Contains(msg, "migraine") ||
		strings.Contains(msg, "fever") || strings.Contains(msg, "chill") ||
		strings.Contains(msg, "cough") || strings.Contains(msg, "cold") ||
		strings.Contains(msg, "stomach") || strings.Contains(msg, "abdomen") {
		return true
	}

	// Very short option-style answers should remain deterministic once context exists.
	if req.Context.Type != "" {
		if msg == "yes" || msg == "no" || msg == "not sure" {
			return true
		}
		if _, err := strconv.Atoi(msg); err == nil {
			return true
		}
	}

	return false
}

func normalizeContextFromMessage(ctx model.SymptomContext, message string) model.SymptomContext {
	msg := strings.ToLower(strings.TrimSpace(message))

	if strings.TrimSpace(ctx.Severity) == "" {
		switch {
		case strings.Contains(msg, "mild"):
			ctx.Severity = "mild"
		case strings.Contains(msg, "moderate"):
			ctx.Severity = "moderate"
		case strings.Contains(msg, "severe"):
			ctx.Severity = "severe"
		default:
			if n, err := strconv.Atoi(strings.TrimSpace(msg)); err == nil {
				switch {
				case n <= 3:
					ctx.Severity = "mild"
				case n <= 7:
					ctx.Severity = "moderate"
				default:
					ctx.Severity = "severe"
				}
			}
		}
	}

	if strings.TrimSpace(ctx.Duration) == "" {
		switch {
		case strings.Contains(msg, "today"):
			ctx.Duration = "Today"
		case strings.Contains(msg, "1") && strings.Contains(msg, "day"):
			ctx.Duration = "1-2 days ago"
		case strings.Contains(msg, "2") && strings.Contains(msg, "day"):
			ctx.Duration = "1-2 days ago"
		case strings.Contains(msg, "3") && strings.Contains(msg, "day"):
			ctx.Duration = "3-5 days ago"
		case strings.Contains(msg, "5") && strings.Contains(msg, "day"):
			ctx.Duration = "More than 5 days ago"
		}
	}

	return ctx
}

func fallbackTriageResponse(req model.SymptomChatRequest) model.SymptomChatResponse {
	ctx := req.Context
	message := strings.ToLower(strings.TrimSpace(req.Message))

	if ctx.Type == "" {
		if strings.Contains(message, "head") || strings.Contains(message, "migraine") {
			ctx.Type = "headache"
		} else if strings.Contains(message, "fever") || strings.Contains(message, "chill") {
			ctx.Type = "fever"
		} else if strings.Contains(message, "cough") || strings.Contains(message, "cold") {
			ctx.Type = "cough"
		} else if strings.Contains(message, "stomach") || strings.Contains(message, "abdomen") {
			ctx.Type = "stomach pain"
		}
	}

	if ctx.Duration == "" {
		switch {
		case strings.Contains(message, "today"):
			ctx.Duration = "Today"
		case strings.Contains(message, "1") && strings.Contains(message, "day"):
			ctx.Duration = "1–2 days ago"
		case strings.Contains(message, "2") && strings.Contains(message, "day"):
			ctx.Duration = "1–2 days ago"
		case strings.Contains(message, "3") && strings.Contains(message, "day"):
			ctx.Duration = "3–5 days ago"
		case strings.Contains(message, "5") && strings.Contains(message, "day"):
			ctx.Duration = "More than 5 days ago"
		}
	}

	if ctx.Severity == "" {
		switch {
		case strings.Contains(message, "mild"):
			ctx.Severity = "mild"
		case strings.Contains(message, "moderate"):
			ctx.Severity = "moderate"
		case strings.Contains(message, "severe"):
			ctx.Severity = "severe"
		}
	}

	if strings.Contains(message, "confusion") || strings.Contains(message, "faint") || strings.Contains(message, "weakness") || strings.Contains(message, "speech") || strings.Contains(message, "worst headache") {
		ctx.RedFlags = true
	}

	resp := model.SymptomChatResponse{
		Reply:         "I’m continuing your symptom assessment. Let’s go step by step.",
		RiskLevel:     "medium",
		Emergency:     false,
		CollectedData: ctx,
		NextQuestion:  nil,
	}

	if ctx.RedFlags {
		resp.RiskLevel = "high"
		resp.Emergency = true
		resp.Reply = "Your symptoms may include emergency warning signs. Please seek urgent medical care immediately."
		return resp
	}

	if strings.TrimSpace(ctx.Type) == "" {
		resp.RiskLevel = "low"
		resp.Reply = "Please tell me the main symptom you are experiencing."
		resp.NextQuestion = &model.NextQuestion{
			Type:     "text",
			Question: "What is your main symptom right now?",
			Options:  []string{},
		}
		return resp
	}

	if strings.TrimSpace(ctx.Duration) == "" {
		resp.RiskLevel = "low"
		resp.Reply = "When did this symptom start?"
		resp.NextQuestion = &model.NextQuestion{
			Type:     "single_choice",
			Question: "How long have you had this symptom?",
			Options:  []string{"Today", "1–2 days ago", "3–5 days ago", "More than 5 days ago", "Not sure"},
		}
		return resp
	}

	if strings.TrimSpace(ctx.Severity) == "" {
		resp.RiskLevel = "low"
		resp.Reply = "How severe is it right now?"
		resp.NextQuestion = &model.NextQuestion{
			Type:     "scale",
			Question: "How severe is your symptom: mild, moderate, or severe?",
			Options:  []string{"Mild", "Moderate", "Severe"},
		}
		return resp
	}

	if strings.TrimSpace(ctx.Location) == "" {
		resp.RiskLevel = "low"
		resp.Reply = "Where exactly do you feel this symptom?"
		resp.NextQuestion = &model.NextQuestion{
			Type:     "text",
			Question: "What body area is affected?",
			Options:  []string{},
		}
		return resp
	}

	resp.RiskLevel = "low"
	resp.Reply = "Thanks. Based on your answers, this appears lower risk right now. Monitor symptoms, rest, hydrate, and seek in-person care if worsening or new red flags appear."
	resp.NextQuestion = nil
	return resp
}

func parseAndValidate(raw string) (model.SymptomChatResponse, error) {
	jsonText, err := extractJSONObject(raw)
	if err != nil {
		return model.SymptomChatResponse{}, err
	}

	var out model.SymptomChatResponse
	if err := json.Unmarshal([]byte(jsonText), &out); err != nil {
		return model.SymptomChatResponse{}, fmt.Errorf("invalid JSON payload: %w", err)
	}

	if strings.TrimSpace(out.Reply) == "" {
		return model.SymptomChatResponse{}, errors.New("missing reply")
	}

	if out.NextQuestion != nil {
		qType := strings.TrimSpace(out.NextQuestion.Type)
		switch qType {
		case "single_choice", "scale", "yes_no", "text":
		default:
			return model.SymptomChatResponse{}, fmt.Errorf("invalid nextQuestion.type: %s", qType)
		}
	}

	return out, nil
}

func extractJSONObject(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return "", errors.New("empty AI response")
	}

	start := strings.Index(text, "{")
	if start == -1 {
		return "", errors.New("json object start not found")
	}

	depth := 0
	for i := start; i < len(text); i++ {
		switch text[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return text[start : i+1], nil
			}
		}
	}

	return "", errors.New("json object end not found")
}