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

// ErrInvalidOutput is returned when the configured enrichment endpoint returns
// structurally valid JSON that does not describe the requested word.
var ErrInvalidOutput = errors.New("enrich: invalid model output")

// ErrUnsupportedLanguage is returned when the configured staging fallback does
// not support the requested target word language.
var ErrUnsupportedLanguage = errors.New("enrich: unsupported target language")

const englishDictionaryFallbackModel = "english-dictionary-fallback-v1"

var validCEFR = map[string]bool{
	"A1": true, "A2": true, "B1": true, "B2": true, "C1": true, "C2": true,
}

var validDifficulty = map[string]bool{
	"easy": true, "medium": true, "hard": true,
}

var validPartOfSpeech = map[string]bool{
	"noun": true, "verb": true, "adjective": true, "adverb": true,
	"pronoun": true, "preposition": true, "conjunction": true,
	"interjection": true, "determiner": true,
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
// Enrich and Translate return ErrNotConfigured.
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

// modelOutput is the JSON contract we ask the model to follow for Enrich.
type modelOutput struct {
	NormalizedText string `json:"normalized_text"`
	Entries        []struct {
		Lemma         string `json:"lemma"`
		PartOfSpeech  string `json:"part_of_speech"`
		Pronunciation string `json:"pronunciation"`
		Senses        []struct {
			Definition            string `json:"definition"`
			ShortDefinition       string `json:"short_definition"`
			CEFRLevel             string `json:"cefr_level"`
			NativeDefinition      string `json:"native_definition"`
			NativeShortDefinition string `json:"native_short_definition"`
			Examples              []struct {
				Sentence    string `json:"sentence"`
				Translation string `json:"translation"`
				Difficulty  string `json:"difficulty"`
			} `json:"examples"`
		} `json:"senses"`
	} `json:"entries"`
}

type translateModelOutput struct {
	Senses []struct {
		Definition      string `json:"definition"`
		ShortDefinition string `json:"short_definition"`
		Examples        []struct {
			Translation string `json:"translation"`
		} `json:"examples"`
	} `json:"senses"`
}

func (e *OpenAIEnricher) Enrich(ctx context.Context, req Request) (Result, error) {
	if e.BaseURL == "" || e.APIKey == "" {
		return Result{}, ErrNotConfigured
	}
	if e.isEnglishDictionaryFallback() && normalizeLang(req.LanguageCode) != "en" {
		return Result{}, fmt.Errorf("%w: target language %q requires a multilingual AI provider", ErrUnsupportedLanguage, req.LanguageCode)
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

	content, err := e.complete(ctx, body)
	if err != nil {
		return Result{}, err
	}
	return parseModelOutput(req, content)
}

func (e *OpenAIEnricher) Translate(ctx context.Context, req TranslateRequest) (TranslateResult, error) {
	if e.BaseURL == "" || e.APIKey == "" {
		return TranslateResult{}, ErrNotConfigured
	}
	if e.isEnglishDictionaryFallback() && normalizeLang(req.LanguageCode) != "en" {
		return TranslateResult{}, fmt.Errorf("%w: target language %q requires a multilingual AI provider", ErrUnsupportedLanguage, req.LanguageCode)
	}

	body, err := json.Marshal(chatRequest{
		Model:       e.Model,
		Temperature: 0.2,
		Messages: []chatMessage{
			{Role: "system", Content: translateSystemPrompt},
			{Role: "user", Content: buildTranslatePrompt(req)},
		},
		ResponseFormat: &responseFormat{Type: "json_object"},
	})
	if err != nil {
		return TranslateResult{}, fmt.Errorf("enrich: marshal translate request: %w", err)
	}

	content, err := e.complete(ctx, body)
	if err != nil {
		return TranslateResult{}, err
	}
	return parseTranslateOutput(req, content)
}

func (e *OpenAIEnricher) isEnglishDictionaryFallback() bool {
	switch strings.ToLower(strings.TrimSpace(e.Model)) {
	case englishDictionaryFallbackModel, "dictionary-ko-v1":
		return true
	default:
		return false
	}
}

func normalizeLang(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if idx := strings.IndexAny(value, "-_"); idx >= 0 {
		return value[:idx]
	}
	return value
}

func (e *OpenAIEnricher) complete(ctx context.Context, body []byte) (string, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, e.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("enrich: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+e.APIKey)

	resp, err := e.Client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("enrich: call endpoint: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("enrich: read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("enrich: endpoint status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var chat chatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return "", fmt.Errorf("enrich: decode envelope: %w", err)
	}
	if len(chat.Choices) == 0 {
		return "", errors.New("enrich: empty completion")
	}
	return chat.Choices[0].Message.Content, nil
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

	expectedText := normalizeModelWord(req.Text)
	if expectedText == "" {
		return Result{}, fmt.Errorf("%w: empty request text", ErrInvalidOutput)
	}

	result := Result{NormalizedText: strings.TrimSpace(out.NormalizedText)}
	if result.NormalizedText == "" {
		result.NormalizedText = expectedText
	}
	if normalizeModelWord(result.NormalizedText) != expectedText {
		return Result{}, fmt.Errorf("%w: normalized_text mismatch: got %q, want %q", ErrInvalidOutput, result.NormalizedText, expectedText)
	}

	for _, entry := range out.Entries {
		pos := strings.TrimSpace(strings.ToLower(entry.PartOfSpeech))
		if !validPartOfSpeech[pos] {
			continue
		}
		lemma := firstNonEmpty(strings.TrimSpace(entry.Lemma), req.Text)
		if normalizeModelWord(lemma) != expectedText {
			return Result{}, fmt.Errorf("%w: lemma mismatch: got %q, want %q", ErrInvalidOutput, lemma, expectedText)
		}
		e := Entry{
			Lemma:         lemma,
			PartOfSpeech:  pos,
			Pronunciation: strings.TrimSpace(entry.Pronunciation),
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
			nativeDef := strings.TrimSpace(s.NativeDefinition)
			if ValidTranslation(req.DefinitionLanguageCode, def, nativeDef) {
				sense.NativeDefinition = nativeDef
				nativeShort := strings.TrimSpace(s.NativeShortDefinition)
				if ValidTranslation(req.DefinitionLanguageCode, sense.ShortDefinition, nativeShort) || nativeShort == "" {
					sense.NativeShortDefinition = nativeShort
				}
			}
			for _, ex := range s.Examples {
				sentence := strings.TrimSpace(ex.Sentence)
				if sentence == "" {
					continue
				}
				difficulty := strings.ToLower(strings.TrimSpace(ex.Difficulty))
				if !validDifficulty[difficulty] {
					difficulty = ""
				}
				translation := strings.TrimSpace(ex.Translation)
				if !ValidTranslation(req.DefinitionLanguageCode, sentence, translation) {
					translation = ""
				}
				sense.Examples = append(sense.Examples, Example{
					Sentence:    sentence,
					Translation: translation,
					Difficulty:  difficulty,
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

func normalizeModelWord(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

func parseTranslateOutput(req TranslateRequest, content string) (TranslateResult, error) {
	jsonText := extractJSONObject(content)
	if jsonText == "" {
		return TranslateResult{}, errors.New("enrich: no JSON object in translate completion")
	}

	var out translateModelOutput
	if err := json.Unmarshal([]byte(jsonText), &out); err != nil {
		return TranslateResult{}, fmt.Errorf("enrich: decode translate JSON: %w", err)
	}
	if len(out.Senses) != len(req.Senses) {
		return TranslateResult{}, errors.New("enrich: translate sense count mismatch")
	}

	var result TranslateResult
	for i, inputSense := range req.Senses {
		modelSense := out.Senses[i]
		senseResult := TranslateSenseResult{SenseID: inputSense.SenseID}

		def := strings.TrimSpace(modelSense.Definition)
		if ValidTranslation(req.DisplayLang, inputSense.Definition, def) {
			senseResult.Definition = def
			shortDef := strings.TrimSpace(modelSense.ShortDefinition)
			if shortDef == "" || ValidTranslation(req.DisplayLang, inputSense.ShortDefinition, shortDef) {
				senseResult.ShortDefinition = shortDef
			}
		}

		if len(modelSense.Examples) != len(inputSense.Examples) {
			return TranslateResult{}, errors.New("enrich: translate example count mismatch")
		}
		for j, inputEx := range inputSense.Examples {
			translation := strings.TrimSpace(modelSense.Examples[j].Translation)
			if ValidTranslation(req.DisplayLang, inputEx.Sentence, translation) {
				senseResult.Examples = append(senseResult.Examples, TranslateExampleResult{
					ExampleID:   inputEx.ExampleID,
					Translation: translation,
				})
			}
		}
		result.Senses = append(result.Senses, senseResult)
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
      "pronunciation": string,
      "senses": [
        {
          "definition": string,
          "short_definition": string,
          "cefr_level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"",
          "native_definition": string,
          "native_short_definition": string,
          "examples": [
            {
              "sentence": string,
              "translation": string,
              "difficulty": "easy"|"medium"|"hard"|""
            }
          ]
        }
      ]
    }
  ]
}`

const translateSystemPrompt = `You are a precise bilingual lexicographer. ` +
	`You return ONLY a single JSON object, no prose, no markdown fences. ` +
	`Translate the provided canonical definitions and example sentences into the requested display language. ` +
	`Preserve any **...** highlight markers in example translations. ` +
	`The JSON must match this shape exactly:
{
  "senses": [
    {
      "definition": string,
      "short_definition": string,
      "examples": [ { "translation": string } ]
    }
  ]
}`

func buildUserPrompt(req Request) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Word: %q\n", req.Text)
	fmt.Fprintf(&b, "Return normalized_text exactly as %q.\n", req.Text)
	fmt.Fprintf(&b, "Every entry lemma must be exactly %q; do not substitute a different example word.\n", req.Text)
	fmt.Fprintf(&b, "Word language code: %s\n", req.LanguageCode)
	fmt.Fprintf(&b, "Write definition and short_definition in %s (the word's language).\n", req.LanguageCode)
	fmt.Fprintf(&b, "Provide a concise phonetic pronunciation for the lemma in %s (e.g., IPA).\n", req.LanguageCode)
	fmt.Fprintf(&b, "Write native_definition and native_short_definition in language code: %s\n", req.DefinitionLanguageCode)
	fmt.Fprintf(&b, "Each example sentence must be written in %s.\n", req.LanguageCode)
	fmt.Fprintf(&b, "Each example translation must be written in %s and wrap the word's meaning with **...** markers.\n", req.DefinitionLanguageCode)

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

	b.WriteString("Provide 3-5 distinct example sentences per sense spanning difficulty labelled easy, medium, and hard. Write a clear short_definition with no length limit.")
	return b.String()
}

func buildTranslatePrompt(req TranslateRequest) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Word: %q\n", req.WordText)
	fmt.Fprintf(&b, "Word language code: %s\n", req.LanguageCode)
	fmt.Fprintf(&b, "Translate into display language code: %s\n", req.DisplayLang)
	b.WriteString("Return one senses[] entry per input sense below, in the same order, with one examples[] translation per input example.\n")
	b.WriteString("Wrap the word's meaning in each example translation with **...** markers.\n\n")

	for i, sense := range req.Senses {
		fmt.Fprintf(&b, "Sense %d definition (%s): %s\n", i+1, req.LanguageCode, sense.Definition)
		if sense.ShortDefinition != "" {
			fmt.Fprintf(&b, "Sense %d short_definition (%s): %s\n", i+1, req.LanguageCode, sense.ShortDefinition)
		}
		for j, ex := range sense.Examples {
			fmt.Fprintf(&b, "Sense %d example %d (%s): %s\n", i+1, j+1, req.LanguageCode, ex.Sentence)
		}
		b.WriteString("\n")
	}
	return b.String()
}
