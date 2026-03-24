package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"AI-symptom-service/internal/model"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

const triageSystemPrompt = `You are a medical symptom triage assistant.

STRICT RULES:
- Return ONLY valid JSON
- No markdown, no extra text, no links
- Response must start with { and end with }

SAFETY:
- Do NOT give diagnosis
- Be cautious and concise

FLOW ORDER:
1. type
2. duration
3. severity
4. painType
5. location
6. redFlags

RED FLAGS:
fever, stiff neck, confusion, fainting, weakness, speech issue, worst headache

RULES:
- Ask ONE question only
- If emergency → nextQuestion=null
- If enough data → give final guidance`

type OpenAIClient struct {
	client openai.Client
}

func NewOpenAIClient(apiKey string) (*OpenAIClient, error) {
	if apiKey == "" {
		return nil, errors.New("missing OPENAI_API_KEY")
	}

	return &OpenAIClient{
		client: openai.NewClient(option.WithAPIKey(apiKey)),
	}, nil
}

func (c *OpenAIClient) Chat(ctx context.Context, req model.SymptomChatRequest, retryHint string) (string, error) {
	payload, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	userPrompt := fmt.Sprintf(`User input JSON:
%s

Respond with schema:
{
  "reply": "string",
  "riskLevel": "low | medium | high",
  "emergency": true | false,
  "collectedData": {
    "type": "",
    "duration": "",
    "severity": "",
    "painType": "",
    "location": "",
    "redFlags": false
  },
  "nextQuestion": {
    "type": "single_choice | scale | yes_no | text",
    "question": "",
    "options": []
  }
}

If emergency=true set nextQuestion to null.`, string(payload))

	if retryHint != "" {
		userPrompt += "\n\nIMPORTANT RETRY INSTRUCTION: " + retryHint
	}

	completion, err := c.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model:       openai.ChatModelGPT4oMini,
		Temperature: openai.Float(0.2),
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(triageSystemPrompt),
			openai.UserMessage(userPrompt),
		},
	})
	if err != nil {
		return "", fmt.Errorf("openai chat completion failed: %w", err)
	}

	if len(completion.Choices) == 0 {
		return "", errors.New("empty completion from OpenAI")
	}

	return completion.Choices[0].Message.Content, nil
}
