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
