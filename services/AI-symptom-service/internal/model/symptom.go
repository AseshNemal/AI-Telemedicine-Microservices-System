package model

import "strings"

type SymptomContext struct {
	Type            string `json:"type"`
	Duration        string `json:"duration"`
	Severity        string `json:"severity"`
	PainType        string `json:"painType"`
	Location        string `json:"location"`
	RedFlags        bool   `json:"redFlags"`
	RecentTravel    string `json:"recentTravel"`
	Medications     string `json:"medications"`
	Allergies       string `json:"allergies"`
	Vision          string `json:"vision"`
	Temperature     string `json:"temperature"`
	AssessmentPhase string `json:"assessmentPhase"`
}

// AssessmentPhase phase constants
const (
	PhaseSymptomType     = "type"
	PhaseDuration        = "duration"
	PhaseSeverity        = "severity"
	PhaseLocation        = "location"
	PhaseContextSpecific = "context_specific"
	PhaseComplete        = "complete"
)

type SymptomChatRequest struct {
	Message string         `json:"message" binding:"required"`
	Context SymptomContext `json:"context"`
}

type NextQuestion struct {
	Type     string   `json:"type"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

type NextSteps struct {
	MedicalRecommendation string `json:"medicalRecommendation"`
	RiskMonitoring        string `json:"riskMonitoring"`
	WhenToSeekCare        string `json:"whenToSeekCare"`
	SpecialistReferral    string `json:"specialistReferral"`
	Urgency               string `json:"urgency"`
}

type SymptomChatResponse struct {
	Reply         string         `json:"reply"`
	RiskLevel     string         `json:"riskLevel"`
	Emergency     bool           `json:"emergency"`
	CollectedData SymptomContext `json:"collectedData"`
	NextQuestion  *NextQuestion  `json:"nextQuestion"`
	NextSteps     *NextSteps     `json:"nextSteps"`
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
	if strings.TrimSpace(other.RecentTravel) != "" {
		merged.RecentTravel = other.RecentTravel
	}
	if strings.TrimSpace(other.Medications) != "" {
		merged.Medications = other.Medications
	}
	if strings.TrimSpace(other.Allergies) != "" {
		merged.Allergies = other.Allergies
	}
	if strings.TrimSpace(other.Vision) != "" {
		merged.Vision = other.Vision
	}
	if strings.TrimSpace(other.Temperature) != "" {
		merged.Temperature = other.Temperature
	}
	if strings.TrimSpace(other.AssessmentPhase) != "" {
		merged.AssessmentPhase = other.AssessmentPhase
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

// DetermineNextPhase calculates what phase of assessment should come next
func (c SymptomContext) DetermineNextPhase() string {
	if c.RedFlags {
		return PhaseComplete
	}

	if strings.TrimSpace(c.Type) == "" {
		return PhaseSymptomType
	}
	if strings.TrimSpace(c.Duration) == "" {
		return PhaseDuration
	}
	if strings.TrimSpace(c.Severity) == "" {
		return PhaseSeverity
	}
	if strings.TrimSpace(c.Location) == "" {
		return PhaseLocation
	}

	switch strings.ToLower(c.Type) {
	case "fever":
		if strings.TrimSpace(c.Temperature) == "" {
			return PhaseContextSpecific
		}
		if strings.TrimSpace(c.RecentTravel) == "" {
			return PhaseContextSpecific
		}
	case "headache":
		if strings.TrimSpace(c.Vision) == "" {
			return PhaseContextSpecific
		}
	}

	return PhaseComplete
}
