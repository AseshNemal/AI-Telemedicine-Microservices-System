package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

	raw, err := s.aiClient.Chat(ctx, req, "")
	if err != nil {
		return model.SymptomChatResponse{}, err
	}

	parsed, err := parseAndValidate(raw)
	if err != nil {
		// Retry once for invalid JSON/shape
		rawRetry, retryErr := s.aiClient.Chat(ctx, req, "Your previous answer was invalid. Return strict JSON only, exactly following the schema.")
		if retryErr != nil {
			return model.SymptomChatResponse{}, retryErr
		}

		parsed, err = parseAndValidate(rawRetry)
		if err != nil {
			return model.SymptomChatResponse{}, fmt.Errorf("failed to parse AI response after retry: %w", err)
		}
	}

	parsed.CollectedData = req.Context.Merge(parsed.CollectedData)
	parsed.RiskLevel = model.NormalizeRiskLevel(parsed.RiskLevel)

	if parsed.CollectedData.RedFlags || parsed.RiskLevel == "high" {
		parsed.Emergency = true
		parsed.NextQuestion = nil
	}

	if parsed.Emergency {
		parsed.NextQuestion = nil
	}

	if strings.TrimSpace(parsed.Reply) == "" {
		return model.SymptomChatResponse{}, errors.New("ai reply is empty")
	}

	return parsed, nil
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
