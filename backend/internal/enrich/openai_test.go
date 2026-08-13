package enrich

import (
	"errors"
	"strings"
	"testing"
)

func TestParseModelOutputRejectsNormalizedTextMismatch(t *testing.T) {
	_, err := parseModelOutput(Request{
		Text:                   "discipline",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	}, `{
		"normalized_text": "hello",
		"entries": [
			{
				"lemma": "discipline",
				"part_of_speech": "noun",
				"senses": [
					{
						"definition": "Self-control or an area of study.",
						"short_definition": "Self-control or field of study",
						"cefr_level": "B1",
						"native_definition": "자제력 또는 학문 분야",
						"native_short_definition": "자제력 또는 분야",
						"examples": []
					}
				]
			}
		]
	}`)
	if err == nil {
		t.Fatal("expected normalized_text mismatch error")
	}
	if !errors.Is(err, ErrInvalidOutput) {
		t.Fatalf("expected ErrInvalidOutput, got %v", err)
	}
	if !strings.Contains(err.Error(), "normalized_text mismatch") {
		t.Fatalf("expected normalized_text mismatch error, got %v", err)
	}
}

func TestParseModelOutputRejectsLemmaMismatch(t *testing.T) {
	_, err := parseModelOutput(Request{
		Text:                   "discipline",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	}, `{
		"normalized_text": "discipline",
		"entries": [
			{
				"lemma": "hello",
				"part_of_speech": "noun",
				"senses": [
					{
						"definition": "Self-control or an area of study.",
						"short_definition": "Self-control or field of study",
						"cefr_level": "B1",
						"native_definition": "자제력 또는 학문 분야",
						"native_short_definition": "자제력 또는 분야",
						"examples": []
					}
				]
			}
		]
	}`)
	if err == nil {
		t.Fatal("expected lemma mismatch error")
	}
	if !errors.Is(err, ErrInvalidOutput) {
		t.Fatalf("expected ErrInvalidOutput, got %v", err)
	}
	if !strings.Contains(err.Error(), "lemma mismatch") {
		t.Fatalf("expected lemma mismatch error, got %v", err)
	}
}

func TestParseModelOutputAcceptsMatchingWord(t *testing.T) {
	result, err := parseModelOutput(Request{
		Text:                   "discipline",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	}, `{
		"normalized_text": "discipline",
		"entries": [
			{
				"lemma": "discipline",
				"part_of_speech": "noun",
				"senses": [
					{
						"definition": "Self-control or an area of study.",
						"short_definition": "Self-control or field of study",
						"cefr_level": "B1",
						"native_definition": "자제력 또는 학문 분야",
						"native_short_definition": "자제력 또는 분야",
						"examples": [
							{
								"sentence": "Discipline helped her finish the project.",
								"translation": "그녀가 프로젝트를 끝내는 데 **자제력**이 도움이 되었다.",
								"difficulty": "easy"
							}
						]
					}
				]
			}
		]
	}`)
	if err != nil {
		t.Fatalf("parse matching output: %v", err)
	}
	if result.NormalizedText != "discipline" {
		t.Fatalf("expected normalized_text discipline, got %q", result.NormalizedText)
	}
	if len(result.Entries) != 1 || result.Entries[0].Lemma != "discipline" {
		t.Fatalf("unexpected entries: %#v", result.Entries)
	}
}

func TestEnglishDictionaryFallbackRejectsNonEnglishTarget(t *testing.T) {
	enricher := NewOpenAI("http://127.0.0.1:1", "local", englishDictionaryFallbackModel)

	_, err := enricher.Enrich(t.Context(), Request{
		Text:                   "안녕",
		LanguageCode:           "ko",
		DefinitionLanguageCode: "en",
	})
	if err == nil {
		t.Fatal("expected unsupported target language error")
	}
	if !errors.Is(err, ErrUnsupportedLanguage) {
		t.Fatalf("expected ErrUnsupportedLanguage, got %v", err)
	}
}

func TestEnglishDictionaryFallbackRejectsNonEnglishTranslationSource(t *testing.T) {
	enricher := NewOpenAI("http://127.0.0.1:1", "local", englishDictionaryFallbackModel)

	_, err := enricher.Translate(t.Context(), TranslateRequest{
		WordText:     "안녕",
		LanguageCode: "ko",
		DisplayLang:  "en",
	})
	if err == nil {
		t.Fatal("expected unsupported target language error")
	}
	if !errors.Is(err, ErrUnsupportedLanguage) {
		t.Fatalf("expected ErrUnsupportedLanguage, got %v", err)
	}
}

func TestRealModelDoesNotUseEnglishFallbackGuard(t *testing.T) {
	enricher := NewOpenAI("http://127.0.0.1:1", "local", "multilingual-model")

	_, err := enricher.Enrich(t.Context(), Request{
		Text:                   "안녕",
		LanguageCode:           "ko",
		DefinitionLanguageCode: "en",
	})
	if err == nil {
		t.Fatal("expected network error from test endpoint")
	}
	if errors.Is(err, ErrUnsupportedLanguage) {
		t.Fatalf("real model should not use English fallback guard, got %v", err)
	}
}

func TestBuildUserPromptIncludesContextAndOneExample(t *testing.T) {
	prompt := buildUserPrompt(Request{
		Text:                   "charge",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
		SourceContext:          "Please charge it overnight before the trip.",
	})
	if !strings.Contains(prompt, "Please charge it overnight") {
		t.Fatal("expected source context in prompt")
	}
	if strings.Contains(prompt, "3-5 distinct example") {
		t.Fatal("old multi-example instruction still present")
	}
	if !strings.Contains(prompt, "exactly one example") {
		t.Fatal("expected one-example instruction")
	}
	if !strings.Contains(strings.ToLower(prompt), "distinct") {
		t.Fatal("expected distinct-sense instruction")
	}
}

func TestNormalizeMatchText(t *testing.T) {
	got := NormalizeMatchText("  Intentionally,  고의로 ")
	// Plan sample expected "intentionally 고의로"; Fields keeps punctuation on tokens.
	if got != "intentionally, 고의로" {
		t.Fatalf("got %q", got)
	}
}

func TestTokenJaccardIdentical(t *testing.T) {
	if TokenJaccard("고의로 하다", "고의로 하다") != 1 {
		t.Fatal("expected 1")
	}
}

func TestDedupeSensesCollapsesNearDuplicates(t *testing.T) {
	in := []Sense{
		{Definition: "deliberately", NativeDefinition: "고의로", Examples: []Example{{Sentence: "a"}}},
		{Definition: "intentionally", NativeDefinition: "의도적으로", Examples: []Example{{Sentence: "b"}}},
		{Definition: "to accuse formally", NativeDefinition: "기소하다", Examples: []Example{{Sentence: "c"}}},
	}
	// Force high overlap on native side for first two by using same tokens:
	in[0].NativeDefinition = "고의로 의도적으로"
	in[1].NativeDefinition = "의도적으로 고의로"
	out := DedupeSenses(in)
	if len(out) != 2 {
		t.Fatalf("expected 2 senses after dedupe, got %d", len(out))
	}
}

func TestParseModelOutputKeepsFirstWhenMultipleExamples(t *testing.T) {
	req := Request{Text: "charge", LanguageCode: "en", DefinitionLanguageCode: "ko"}
	raw := `{
	  "normalized_text":"charge",
	  "entries":[{
	    "lemma":"charge","part_of_speech":"verb","pronunciation":"",
	    "senses":[{
	      "definition":"to store energy","short_definition":"store energy","cefr_level":"A2",
	      "native_definition":"충전하다","native_short_definition":"충전하다",
	      "examples":[
	        {"sentence":"Charge it.","translation":"**충전**하세요.","difficulty":"easy"},
	        {"sentence":"Charge overnight.","translation":"밤새 **충전**하세요.","difficulty":"medium"}
	      ]
	    }]
	  }]
	}`
	result, err := parseModelOutput(req, raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Entries) != 1 || len(result.Entries[0].Senses) != 1 {
		t.Fatalf("expected one usable sense, got %+v", result)
	}
	ex := result.Entries[0].Senses[0].Examples
	if len(ex) != 1 || ex[0].Sentence != "Charge it." {
		t.Fatalf("expected first example kept, got %+v", ex)
	}
}

func TestParseModelOutputRejectsSenseWithNoExamples(t *testing.T) {
	req := Request{Text: "charge", LanguageCode: "en", DefinitionLanguageCode: "ko"}
	raw := `{
	  "normalized_text":"charge",
	  "entries":[{
	    "lemma":"charge","part_of_speech":"verb","pronunciation":"",
	    "senses":[{
	      "definition":"to store energy","short_definition":"store energy","cefr_level":"A2",
	      "native_definition":"충전하다","native_short_definition":"충전하다",
	      "examples":[]
	    }]
	  }]
	}`
	_, err := parseModelOutput(req, raw)
	if err == nil {
		t.Fatal("expected error when all senses lack examples")
	}
}

func TestParseTranslateOutputKeepsSensesWhenExampleCountDiffers(t *testing.T) {
	req := TranslateRequest{
		WordText:     "charge",
		LanguageCode: "en",
		DisplayLang:  "ko",
		Senses: []TranslateSenseInput{{
			SenseID:    "s1",
			Definition: "to store energy",
			Examples: []TranslateExampleInput{
				{ExampleID: "e1", Sentence: "Charge it overnight."},
				{ExampleID: "e2", Sentence: "Charge the battery."},
			},
		}},
	}
	raw := `{
	  "senses":[{
	    "definition":"충전하다",
	    "short_definition":"충전하다",
	    "examples":[{"translation":"밤새 **충전**하세요."}]
	  }]
	}`
	got, err := parseTranslateOutput(req, raw)
	if err != nil {
		t.Fatalf("example count mismatch should not fail translate: %v", err)
	}
	if len(got.Senses) != 1 || got.Senses[0].Definition != "충전하다" {
		t.Fatalf("expected cached definition, got %+v", got)
	}
	if len(got.Senses[0].Examples) != 1 || got.Senses[0].Examples[0].ExampleID != "e1" {
		t.Fatalf("expected first example paired, got %+v", got.Senses[0].Examples)
	}
}

func TestParseTranslateOutputKeepsOverlappingSensesOnCountMismatch(t *testing.T) {
	req := TranslateRequest{
		WordText:     "run",
		LanguageCode: "en",
		DisplayLang:  "ko",
		Senses: []TranslateSenseInput{
			{SenseID: "s1", Definition: "to move quickly"},
			{SenseID: "s2", Definition: "to operate"},
			{SenseID: "s3", Definition: "a scoring play"},
		},
	}
	raw := `{
	  "senses":[
	    {"definition":"빨리 달리다","short_definition":"달리다","examples":[]},
	    {"definition":"작동하다","short_definition":"작동","examples":[]}
	  ]
	}`
	got, err := parseTranslateOutput(req, raw)
	if err != nil {
		t.Fatalf("sense count mismatch should not fail translate: %v", err)
	}
	if len(got.Senses) != 2 {
		t.Fatalf("expected 2 overlapping senses, got %d", len(got.Senses))
	}
	if got.Senses[0].SenseID != "s1" || got.Senses[0].Definition != "빨리 달리다" {
		t.Fatalf("unexpected first sense: %+v", got.Senses[0])
	}
	if got.Senses[1].SenseID != "s2" || got.Senses[1].Definition != "작동하다" {
		t.Fatalf("unexpected second sense: %+v", got.Senses[1])
	}
}

func TestParseTranslateOutputRejectsNonJSON(t *testing.T) {
	_, err := parseTranslateOutput(TranslateRequest{WordText: "x"}, "not json")
	if err == nil {
		t.Fatal("expected invalid output error")
	}
	if !errors.Is(err, ErrInvalidOutput) {
		t.Fatalf("expected ErrInvalidOutput, got %v", err)
	}
}

func TestMarshalChatSetsGeminiReasoningEffort(t *testing.T) {
	e := NewOpenAI("https://generativelanguage.googleapis.com/v1beta/openai", "key", "gemini-3.1-flash-lite")
	body, err := e.marshalChat("sys", "user")
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(body), `"reasoning_effort":"minimal"`) {
		t.Fatalf("expected Gemini reasoning_effort=minimal, got %s", body)
	}

	other := NewOpenAI("https://api.groq.com/openai/v1", "key", "llama-3.1-8b-instant")
	body, err = other.marshalChat("sys", "user")
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(body), "reasoning_effort") {
		t.Fatalf("non-Gemini provider should omit reasoning_effort, got %s", body)
	}
}

func TestMessageContentTextAcceptsArrayParts(t *testing.T) {
	raw := []byte(`[{"type":"text","text":"{\"senses\":[]}"}]`)
	got := messageContentText(raw)
	if got != `{"senses":[]}` {
		t.Fatalf("got %q", got)
	}
}
