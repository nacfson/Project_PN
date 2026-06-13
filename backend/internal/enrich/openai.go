package enrich

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ErrNotConfigured is returned when no enrichment endpoint is configured.
// Callers treat this as "generation unavailable" and fall back to manual entry.
var ErrNotConfigured = errors.New("enrich: endpoint not configured")

var validCEFR = map[string]bool{
	"A1": true, "A2": true, "B1": true, "B2": true, "C1": true, "C2": true,
}

// OpenAIEnricher calls any OpenAI-compatible /chat/completions endpoint
// (Groq, DeepSeek, Gemini's OpenAI shim, etc.).
type OpenAIEnricher struct {
	BaseURL string
	APIKey  string
	Model   string
	Client  *http.Client
}

// NewOpenAI builds an enricher. baseURL/apiKey may be empty, in which case
// Enrich returns ErrNotConfigured.
func NewOpenAI(baseURL, apiKey, model string) *OpenAIEnricher {
	return &OpenAIEnricher{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  apiKey,
		Model:   model,
		Client:  &http.Client{Timeout: 30 * time.Second},
	}
}

type chatRequest struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	Temperature    float64         `json:"temperature"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

// modelOutput is the JSON contract we ask the model to follow.
type modelOutput struct {
	NormalizedText string `json:"normalized_text"`
	Entries        []struct {
		Lemma        string `json:"lemma"`
		PartOfSpeech string `json:"part_of_speech"`
		Senses       []struct {
			Definition      string `json:"definition"`
			ShortDefinition string `json:"short_definition"`
			CEFRLevel       string `json:"cefr_level"`
			Examples        []struct {
				Sentence    string `json:"sentence"`
				Translation string `json:"translation"`
			} `json:"examples"`
		} `json:"senses"`
	} `json:"entries"`
}

func (e *OpenAIEnricher) Enrich(ctx context.Context, req Request) (Result, error) {
	if e.BaseURL == "" || e.APIKey == "" {
		return Result{}, ErrNotConfigured
	}

	body, err := json.Marshal(chatRequest{
		Model:       e.Model,
		Temperature: 0.2,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: buildUserPrompt(req)},
		},
		ResponseFormat: &responseFormat{Type: "json_object"},
	})
	if err != nil {
		return Result{}, fmt.Errorf("enrich: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, e.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return Result{}, fmt.Errorf("enrich: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+e.APIKey)

	resp, err := e.Client.Do(httpReq)
	if err != nil {
		return Result{}, fmt.Errorf("enrich: call endpoint: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Result{}, fmt.Errorf("enrich: read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("enrich: endpoint status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var chat chatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return Result{}, fmt.Errorf("enrich: decode envelope: %w", err)
	}
	if len(chat.Choices) == 0 {
		return Result{}, errors.New("enrich: empty completion")
	}

	return parseModelOutput(req, chat.Choices[0].Message.Content)
}

func parseModelOutput(req Request, content string) (Result, error) {
	jsonText := extractJSONObject(content)
	if jsonText == "" {
		return Result{}, errors.New("enrich: no JSON object in completion")
	}

	var out modelOutput
	if err := json.Unmarshal([]byte(jsonText), &out); err != nil {
		return Result{}, fmt.Errorf("enrich: decode model JSON: %w", err)
	}

	result := Result{NormalizedText: strings.TrimSpace(out.NormalizedText)}
	if result.NormalizedText == "" {
		result.NormalizedText = strings.ToLower(strings.TrimSpace(req.Text))
	}

	for _, entry := range out.Entries {
		pos := strings.TrimSpace(strings.ToLower(entry.PartOfSpeech))
		if pos == "" {
			continue
		}
		e := Entry{
			Lemma:        firstNonEmpty(strings.TrimSpace(entry.Lemma), req.Text),
			PartOfSpeech: pos,
		}
		for _, s := range entry.Senses {
			def := strings.TrimSpace(s.Definition)
			if def == "" {
				continue
			}
			cefr := strings.ToUpper(strings.TrimSpace(s.CEFRLevel))
			if !validCEFR[cefr] {
				cefr = ""
			}
			sense := Sense{
				Definition:      def,
				ShortDefinition: strings.TrimSpace(s.ShortDefinition),
				CEFRLevel:       cefr,
			}
			for _, ex := range s.Examples {
				sentence := strings.TrimSpace(ex.Sentence)
				if sentence == "" {
					continue
				}
				sense.Examples = append(sense.Examples, Example{
					Sentence:    sentence,
					Translation: strings.TrimSpace(ex.Translation),
				})
			}
			e.Senses = append(e.Senses, sense)
		}
		if len(e.Senses) > 0 {
			result.Entries = append(result.Entries, e)
		}
	}

	if len(result.Entries) == 0 {
		return Result{}, errors.New("enrich: model returned no usable senses")
	}
	return result, nil
}

// extractJSONObject returns the substring from the first '{' to the last '}'.
func extractJSONObject(s string) string {
	start := strings.IndexByte(s, '{')
	end := strings.LastIndexByte(s, '}')
	if start == -1 || end == -1 || end < start {
		return ""
	}
	return s[start : end+1]
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

const systemPrompt = `You are a precise bilingual lexicographer. ` +
	`You return ONLY a single JSON object, no prose, no markdown fences. ` +
	`The JSON must match this shape exactly:
{
  "normalized_text": string,
  "entries": [
    {
      "lemma": string,
      "part_of_speech": "noun"|"verb"|"adjective"|"adverb"|"pronoun"|"preposition"|"conjunction"|"interjection"|"determiner",
      "senses": [
        {
          "definition": string,
          "short_definition": string,
          "cefr_level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"",
          "examples": [ { "sentence": string, "translation": string } ]
        }
      ]
    }
  ]
}`

func buildUserPrompt(req Request) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Word: %q\n", req.Text)
	fmt.Fprintf(&b, "Word language code: %s\n", req.LanguageCode)
	fmt.Fprintf(&b, "Write every definition, short_definition and example translation in language code: %s\n", req.DefinitionLanguageCode)
	fmt.Fprintf(&b, "Each example sentence must be written in %s.\n", req.LanguageCode)

	if pos := strings.TrimSpace(req.POS); pos != "" && !strings.EqualFold(pos, "any") {
		fmt.Fprintf(&b, "Only include entries whose part_of_speech is exactly %q.\n", strings.ToLower(pos))
	} else {
		b.WriteString("Include one entry per part of speech that this word commonly has.\n")
	}

	if len(req.Existing) > 0 {
		b.WriteString("These senses already exist; do NOT repeat them, return a different, additional sense:\n")
		for _, d := range req.Existing {
			fmt.Fprintf(&b, "- %s\n", d)
		}
	}

	b.WriteString("Provide 1-2 example sentences per sense. Keep short_definition under 8 words.")
	return b.String()
}
