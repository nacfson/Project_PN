package enrich

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
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

// ErrUnavailable is returned when the configured enrichment endpoint cannot be
// reached or rejects the request (transport error or non-200 status), so callers
// can distinguish provider outages from missing configuration.
var ErrUnavailable = errors.New("enrich: endpoint unavailable")

// ErrNoAdditionalSenses is returned when the enricher found the word but every
// gloss/sense for the requested scope is already stored (typical WiktApi force path).
var ErrNoAdditionalSenses = errors.New("enrich: no additional senses")

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
	"interjection": true, "determiner": true, "phrase": true,
}

// OpenAIEnricher calls an OpenAI-compatible /chat/completions endpoint.
// Production wiring routes through the cluster AI proxy with URL + model only.
type OpenAIEnricher struct {
	BaseURL string
	Model   string
	Client  *http.Client
	Logger  *slog.Logger
}

// NewOpenAI builds an enricher. baseURL/model may be empty, in which case
// Enrich and Translate return ErrNotConfigured.
func NewOpenAI(baseURL, model string) *OpenAIEnricher {
	return &OpenAIEnricher{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Model:   strings.TrimSpace(model),
		Client:  &http.Client{Timeout: 30 * time.Second},
		Logger:  slog.Default(),
	}
}

func (e *OpenAIEnricher) logger() *slog.Logger {
	if e != nil && e.Logger != nil {
		return e.Logger
	}
	return slog.Default()
}

type chatRequest struct {
	Model           string          `json:"model"`
	Messages        []chatMessage   `json:"messages"`
	Temperature     float64         `json:"temperature"`
	ResponseFormat  *responseFormat `json:"response_format,omitempty"`
	ReasoningEffort string          `json:"reasoning_effort,omitempty"`
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
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Role    string          `json:"role"`
			Content json.RawMessage `json:"content"`
		} `json:"message"`
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
	if e.BaseURL == "" || e.Model == "" {
		return Result{}, ErrNotConfigured
	}
	if e.isEnglishDictionaryFallback() && normalizeLang(req.LanguageCode) != "en" {
		return Result{}, fmt.Errorf("%w: target language %q requires a multilingual AI provider", ErrUnsupportedLanguage, req.LanguageCode)
	}

	body, err := e.marshalChat(systemPrompt, buildUserPrompt(req))
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
	if e.BaseURL == "" || e.Model == "" {
		return TranslateResult{}, ErrNotConfigured
	}
	if e.isEnglishDictionaryFallback() && normalizeLang(req.LanguageCode) != "en" {
		return TranslateResult{}, fmt.Errorf("%w: target language %q requires a multilingual AI provider", ErrUnsupportedLanguage, req.LanguageCode)
	}

	body, err := e.marshalChat(translateSystemPrompt, buildTranslatePrompt(req))
	if err != nil {
		return TranslateResult{}, fmt.Errorf("enrich: marshal translate request: %w", err)
	}

	content, err := e.complete(ctx, body)
	if err != nil {
		return TranslateResult{}, err
	}
	return parseTranslateOutput(req, content)
}

func (e *OpenAIEnricher) marshalChat(system, user string) ([]byte, error) {
	req := chatRequest{
		Model:       e.Model,
		Temperature: 0.2,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		ResponseFormat: &responseFormat{Type: "json_object"},
	}
	if e.usesGeminiThinking() {
		// Gemini 3.x defaults to thinking; keep it minimal so structured
		// JSON translations stay in message.content instead of stalling or 400ing.
		req.ReasoningEffort = "minimal"
	}
	return json.Marshal(req)
}

func (e *OpenAIEnricher) usesGeminiThinking() bool {
	base := strings.ToLower(e.BaseURL)
	model := strings.ToLower(strings.TrimSpace(e.Model))
	return strings.Contains(base, "generativelanguage.googleapis.com") || strings.HasPrefix(model, "gemini-")
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

	resp, err := e.Client.Do(httpReq)
	if err != nil {
		e.logger().Error("enrich: llm request failed", "url", e.BaseURL+"/chat/completions", "model", e.Model, "error", err)
		return "", fmt.Errorf("%w: call endpoint: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("%w: read response: %v", ErrUnavailable, err)
	}
	if resp.StatusCode != http.StatusOK {
		e.logger().Error("enrich: llm request failed", "url", e.BaseURL+"/chat/completions", "model", e.Model, "status_code", resp.StatusCode, "body", strings.TrimSpace(string(raw)))
		return "", fmt.Errorf("%w: endpoint status %d: %s", ErrUnavailable, resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var chat chatResponse
	if err := json.Unmarshal(raw, &chat); err != nil {
		return "", fmt.Errorf("enrich: decode envelope: %w", err)
	}
	if len(chat.Choices) == 0 {
		return "", fmt.Errorf("%w: empty completion", ErrInvalidOutput)
	}
	content := messageContentText(chat.Choices[0].Message.Content)
	if strings.TrimSpace(content) == "" {
		return "", fmt.Errorf("%w: empty completion (finish_reason=%s)", ErrInvalidOutput, strings.TrimSpace(chat.Choices[0].FinishReason))
	}
	return content, nil
}

func messageContentText(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err == nil {
		var b strings.Builder
		for _, p := range parts {
			b.WriteString(p.Text)
		}
		return b.String()
	}
	return ""
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
		if IsMultiWordLemma(lemma) || IsMultiWordLemma(req.Text) {
			pos = "phrase"
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
				ShortDefinition: PreferSimpleGlossForLemma(lemma, strings.TrimSpace(s.ShortDefinition), def),
				CEFRLevel:       cefr,
			}
			nativeDef := strings.TrimSpace(s.NativeDefinition)
			if ValidTranslation(req.DefinitionLanguageCode, def, nativeDef) {
				sense.NativeDefinition = nativeDef
				nativeShort := strings.TrimSpace(s.NativeShortDefinition)
				if ValidTranslation(req.DefinitionLanguageCode, sense.ShortDefinition, nativeShort) || nativeShort == "" {
					sense.NativeShortDefinition = PreferSimpleGlossForLemma(lemma, nativeShort, nativeDef)
				}
			}
			var keptExamples []Example
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
				keptExamples = append(keptExamples, Example{
					Sentence:    sentence,
					Translation: translation,
					Difficulty:  difficulty,
				})
			}
			// Exactly one example per sense. Models often still return 3–5;
			// keep the first usable sentence rather than discarding the sense.
			if len(keptExamples) == 0 {
				continue
			}
			sense.Examples = keptExamples[:1]
			e.Senses = append(e.Senses, sense)
		}
		e.Senses = DedupeSenses(e.Senses)
		if len(e.Senses) > 0 {
			result.Entries = append(result.Entries, e)
		}
	}

	if len(result.Entries) == 0 {
		return Result{}, fmt.Errorf("%w: model returned no usable senses", ErrInvalidOutput)
	}
	return result, nil
}

func normalizeModelWord(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

func parseTranslateOutput(req TranslateRequest, content string) (TranslateResult, error) {
	jsonText := extractJSONObject(content)
	if jsonText == "" {
		return TranslateResult{}, fmt.Errorf("%w: no JSON object in translate completion", ErrInvalidOutput)
	}

	var out translateModelOutput
	if err := json.Unmarshal([]byte(jsonText), &out); err != nil {
		return TranslateResult{}, fmt.Errorf("%w: decode translate JSON: %v", ErrInvalidOutput, err)
	}

	wantSenses, gotSenses := len(req.Senses), len(out.Senses)
	if gotSenses != wantSenses {
		slog.Warn("enrich: translate sense count mismatch; keeping overlapping senses",
			"word", req.WordText, "want", wantSenses, "got", gotSenses)
	}
	n := gotSenses
	if n > wantSenses {
		n = wantSenses
	}

	var result TranslateResult
	for i := 0; i < n; i++ {
		inputSense := req.Senses[i]
		modelSense := out.Senses[i]
		senseResult := TranslateSenseResult{SenseID: inputSense.SenseID}

		def := strings.TrimSpace(modelSense.Definition)
		if ValidTranslation(req.DisplayLang, inputSense.Definition, def) {
			senseResult.Definition = def
			shortDef := strings.TrimSpace(modelSense.ShortDefinition)
			if shortDef == "" || ValidTranslation(req.DisplayLang, inputSense.ShortDefinition, shortDef) {
				senseResult.ShortDefinition = PreferSimpleGlossForLemma(req.WordText, shortDef, def)
			}
		} else if def != "" {
			slog.Warn("enrich: dropped invalid sense translation",
				"word", req.WordText,
				"display_lang", req.DisplayLang,
				"sense_id", inputSense.SenseID,
				"translation", clipForLog(def, 80),
			)
		}

		wantExamples, gotExamples := len(inputSense.Examples), len(modelSense.Examples)
		if gotExamples != wantExamples {
			slog.Warn("enrich: translate example count mismatch; pairing by index",
				"word", req.WordText,
				"sense_id", inputSense.SenseID,
				"want", wantExamples,
				"got", gotExamples,
			)
		}
		exampleN := gotExamples
		if exampleN > wantExamples {
			exampleN = wantExamples
		}
		for j := 0; j < exampleN; j++ {
			inputEx := inputSense.Examples[j]
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

func clipForLog(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	if max <= 0 || len([]rune(s)) <= max {
		return s
	}
	runes := []rune(s)
	return string(runes[:max]) + "…"
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
      "part_of_speech": "noun"|"verb"|"adjective"|"adverb"|"pronoun"|"preposition"|"conjunction"|"interjection"|"determiner"|"phrase",
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
}
Each sense MUST include exactly one object in "examples" (length 1).
short_definition and native_short_definition must express usage meaning, never grammatical category names.`

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

func appendGrammarLabelBan(b *strings.Builder) {
	b.WriteString("NEVER use grammatical category names or meta labels as short_definition or native_short_definition.\n")
	b.WriteString("Forbidden Korean examples: 관계대명사, 관계부사, 대명사, 부사, 접속사, 전치사, 조사.\n")
	b.WriteString("Forbidden English examples: relative pronoun, relative adverb, conjunction, preposition, determiner, interjection.\n")
	b.WriteString("Forbidden meta labels: relative reference, classificatory, subset identifier, causal, manner (as category names).\n")
	b.WriteString("Instead use functional glosses that express what the lemma means in use (where, wherein, by which means).\n")
}

func appendPhraseGlossRules(b *strings.Builder, sourceContext string) {
	b.WriteString("This is a multi-word phrase / function expression, not a single headword.\n")
	b.WriteString("part_of_speech MUST be exactly \"phrase\" (do not use noun/verb/adjective for multi-word lemmas).\n")
	b.WriteString("native_short_definition should be a short usage gloss (1-4 words or a compact pattern): ~하는 데, 그곳에서, ~인 경우에, ~하는 방식으로.\n")
	b.WriteString("For multi-word phrases, compact ~… usage patterns ARE allowed in native_short_definition (unlike single-word headwords).\n")
	b.WriteString("Return 2-4 clearly distinct functional senses; do not duplicate the same grammar label across senses.\n")
	b.WriteString("Example for \"in which\": bad native_short_definition \"관계대명사\" or short_definition \"relative reference\"; good native_short_definition \"~하는 데\" or \"그곳에서\" with short_definition \"where\"; or native_short_definition \"~인 경우에\" with short_definition \"wherein\".\n")
	if sourceContext != "" {
		b.WriteString("Tie the primary sense's short gloss to the provided source context usage.\n")
	}
}

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

	if ctx := strings.TrimSpace(req.SourceContext); ctx != "" {
		fmt.Fprintf(&b, "Source context (where the learner saw this word): %q\n", ctx)
		b.WriteString("Prioritize senses that fit that context; still return other clearly distinct common senses for the lemma.\n")
	}

	b.WriteString("Provide mutually distinct senses (different intents); do not emit near-synonym gloss pairs as separate senses.\n")
	b.WriteString("Provide exactly one example sentence per sense.\n")
	if IsMultiWordLemma(req.Text) {
		b.WriteString("short_definition must be a simple 1-3 word functional gloss in the word's language (where, wherein, by which means) — not a sentence and not a grammar-class label.\n")
		appendPhraseGlossRules(&b, strings.TrimSpace(req.SourceContext))
	} else {
		b.WriteString("short_definition must be a simple 1-3 word headword gloss in the word's language (cover, apple, expose) — not a sentence and not an infinitive paraphrase like \"To cover something with soil\".\n")
		b.WriteString("native_short_definition must be a simple lexical gloss in the display language, typically one word: 덮다, 사과, 노출하다, 묻다. Do NOT write a dictionary paraphrase, pattern like \"~을 덮다\", or a clause like \"무엇을 흙이나 눈 등으로 덮어 감추다\".\n")
	}
	appendGrammarLabelBan(&b)
	b.WriteString("definition / native_definition stay the fuller current meaning (e.g. native_definition: 흙이나 눈 등으로 ~을 덮다).\n")
	return b.String()
}

func buildTranslatePrompt(req TranslateRequest) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Word: %q\n", req.WordText)
	fmt.Fprintf(&b, "Word language code: %s\n", req.LanguageCode)
	fmt.Fprintf(&b, "Translate into display language code: %s\n", req.DisplayLang)
	b.WriteString("Return one senses[] entry per input sense below, in the same order, with one examples[] translation per input example.\n")
	b.WriteString("definition is the fuller current meaning in the display language.\n")
	if IsMultiWordLemma(req.WordText) {
		b.WriteString("short_definition must be a simple functional gloss in the display language (~하는 데, 그곳에서) — not a full explanatory translation.\n")
		b.WriteString("For this multi-word phrase, compact ~… usage patterns ARE allowed in short_definition.\n")
	} else {
		b.WriteString("short_definition must be a simple 1-word (or very short) lexical gloss in the display language, like 덮다, 사과, or 노출하다 — not a full explanatory translation.\n")
	}
	appendGrammarLabelBan(&b)
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
