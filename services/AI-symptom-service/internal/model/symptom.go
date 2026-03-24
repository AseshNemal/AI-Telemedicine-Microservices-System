package model

import "strings"

type SymptomContext struct {
	Type     string `json:"type"`
	Duration string `json:"duration"`
	Severity string `json:"severity"`
	PainType string `json:"painType"`
	Location string `json:"location"`
	RedFlags bool   `json:"redFlags"`
}

type SymptomChatRequest struct {
	Message string         `json:"message" binding:"required"`
	Context SymptomContext `json:"context"`
}

type NextQuestion struct {
	Type     string   `json:"type"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

type SymptomChatResponse struct {
	Reply         string         `json:"reply"`
	RiskLevel     string         `json:"riskLevel"`
	Emergency     bool           `json:"emergency"`
	CollectedData SymptomContext `json:"collectedData"`
	NextQuestion  *NextQuestion  `json:"nextQuestion"`
}

func (c SymptomContext) Merge(other SymptomContext) SymptomContext {
	merged := c
	if strings.TrimSpace(other.Type) != "" {
		merged.Type = other.Type
	}
	if strings.TrimSpace(other.Duration) != "" {
		merged.Duration = other.Duration
	}
	if strings.TrimSpace(other.Severity) != "" {
		merged.Severity = other.Severity
	}
	if strings.TrimSpace(other.PainType) != "" {
		merged.PainType = other.PainType
	}
	if strings.TrimSpace(other.Location) != "" {
		merged.Location = other.Location
	}
	if other.RedFlags {
		merged.RedFlags = true
	}
	return merged
}

func NormalizeRiskLevel(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "low":
		return "low"
	case "high":
		return "high"
	default:
		return "medium"
	}
}
