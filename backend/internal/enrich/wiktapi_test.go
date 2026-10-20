package enrich

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWiktAPIEnrichMapsKoreanGlosses(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/word/have/translations") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"word": "have",
			"edition": "en",
			"translations": [
				{"pos": "verb", "lang_code": "en", "translations": [
					{"lang": "Korean", "code": "ko", "lang_code": "ko", "sense": "to possess", "word": "가지다"},
					{"lang": "Korean", "code": "ko", "lang_code": "ko", "sense": "to possess", "word": "있다"},
					{"lang": "Korean", "code": "ko", "lang_code": "ko", "sense": "give birth to", "word": "낳다"}
				]}
			]
		}`))
	}))
	t.Cleanup(srv.Close)

	client := NewWiktAPI(srv.URL)
	result, err := client.Enrich(context.Background(), Request{
		Text:                   "have",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	})
	if err != nil {
		t.Fatalf("Enrich: %v", err)
	}
	if len(result.Entries) != 1 || result.Entries[0].PartOfSpeech != "verb" {
		t.Fatalf("entries=%+v", result.Entries)
	}
	if len(result.Entries[0].Senses) != 3 {
		t.Fatalf("senses=%d want 3", len(result.Entries[0].Senses))
	}
	first := result.Entries[0].Senses[0]
	if first.NativeShortDefinition != "가지다" || first.NativeDefinition != "가지다" {
		t.Fatalf("first gloss=%+v", first)
	}
	if first.Definition != "to possess" {
		t.Fatalf("definition=%q", first.Definition)
	}
	if len(first.Examples) != 0 {
		t.Fatalf("expected no examples, got %d", len(first.Examples))
	}
}

func TestWiktAPIEnrichCoercesMultiWordToPhrase(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/word/rule%20of%20thumb/translations") &&
			!strings.Contains(r.URL.Path, "/word/rule of thumb/translations") {
			// PathEscape encodes spaces as %20
			if !strings.Contains(r.URL.EscapedPath(), "rule") {
				http.NotFound(w, r)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"word": "rule of thumb",
			"edition": "en",
			"translations": [
				{"pos": "noun", "lang_code": "en", "translations": [
					{"lang": "Korean", "code": "ko", "lang_code": "ko", "sense": "practical method", "word": "경험칙"}
				]}
			]
		}`))
	}))
	t.Cleanup(srv.Close)

	client := NewWiktAPI(srv.URL)
	result, err := client.Enrich(context.Background(), Request{
		Text:                   "rule of thumb",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	})
	if err != nil {
		t.Fatalf("Enrich: %v", err)
	}
	if len(result.Entries) != 1 || result.Entries[0].PartOfSpeech != "phrase" {
		t.Fatalf("expected phrase POS for multi-word lemma, got %+v", result.Entries)
	}
}

func TestWiktAPIEnrichSkipsExistingAnd404(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "missing") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"word": "have",
			"translations": [
				{"pos": "verb", "translations": [
					{"lang_code": "ko", "sense": "to possess", "word": "가지다"},
					{"lang_code": "ko", "sense": "to possess", "word": "있다"}
				]}
			]
		}`))
	}))
	t.Cleanup(srv.Close)

	client := NewWiktAPI(srv.URL)
	result, err := client.Enrich(context.Background(), Request{
		Text:                   "have",
		DefinitionLanguageCode: "ko",
		Existing:               []string{"가지다"},
	})
	if err != nil {
		t.Fatalf("Enrich: %v", err)
	}
	if len(result.Entries[0].Senses) != 1 || result.Entries[0].Senses[0].NativeShortDefinition != "있다" {
		t.Fatalf("senses=%+v", result.Entries[0].Senses)
	}

	_, err = client.Enrich(context.Background(), Request{Text: "missing", DefinitionLanguageCode: "ko"})
	if err == nil {
		t.Fatal("expected error for 404")
	}

	_, err = client.Enrich(context.Background(), Request{
		Text:                   "have",
		DefinitionLanguageCode: "ko",
		Existing:               []string{"가지다", "있다"},
	})
	if !errors.Is(err, ErrNoAdditionalSenses) {
		t.Fatalf("expected ErrNoAdditionalSenses when all glosses exist, got %v", err)
	}
}

func TestWiktAPIEnrichFallsBackToDisplayDefinitionsWhenTranslationsMiss(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/en/word/procurement/translations":
			_, _ = w.Write([]byte(`{
				"word": "procurement",
				"edition": "en",
				"translations": [
					{"pos": "noun", "lang_code": "en", "translations": [
						{"lang": "French", "code": "fr", "lang_code": "fr", "sense": "the act of procuring or obtaining", "word": "approvisionnement"}
					]}
				]
			}`))
		case "/v1/ko/word/procurement/definitions":
			_, _ = w.Write([]byte(`{
				"word": "procurement",
				"edition": "ko",
				"definitions": [
					{"pos": "unknown", "lang_code": "en", "senses": [
						{"glosses": ["입수, 획득, 조달, 구매"]},
						{"glosses": ["(회사의) 구매 부서, 구매 팀."]}
					]}
				]
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	client := NewWiktAPI(srv.URL)
	result, err := client.Enrich(context.Background(), Request{
		Text:                   "procurement",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	})
	if err != nil {
		t.Fatalf("Enrich: %v", err)
	}
	if len(result.Entries) != 1 {
		t.Fatalf("entries=%+v", result.Entries)
	}
	if result.Entries[0].PartOfSpeech != "noun" {
		t.Fatalf("PartOfSpeech=%q, want noun", result.Entries[0].PartOfSpeech)
	}
	filtered := FilterProperSenses(nil, result.Entries[0].Senses, "ko", "procurement")
	if len(filtered) < 4 {
		t.Fatalf("expected at least 4 senses after FilterProperSenses, got %d (%+v)", len(filtered), filtered)
	}
	gotShort := map[string]bool{}
	for _, s := range filtered {
		gotShort[s.NativeShortDefinition] = true
	}
	for _, want := range []string{"입수", "획득", "조달", "구매"} {
		if !gotShort[want] {
			t.Fatalf("missing expected short gloss %q in %+v", want, gotShort)
		}
	}
}

func TestWiktAPIEnrichFallsBackToEnglishStemDefinitions(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/en/word/intertwined/translations":
			_, _ = w.Write([]byte(`{
				"word": "intertwined",
				"edition": "en",
				"translations": [
					{"pos": "adj", "lang_code": "en", "translations": [
						{"lang": "French", "code": "fr", "lang_code": "fr", "sense": "twined or twisted together", "word": "entrelacé"}
					]},
					{"pos": "verb", "lang_code": "en", "translations": []}
				]
			}`))
		case "/v1/ko/word/intertwined/definitions":
			http.NotFound(w, r)
		case "/v1/en/word/intertwine/translations":
			_, _ = w.Write([]byte(`{
				"word": "intertwine",
				"edition": "en",
				"translations": [
					{"pos": "verb", "lang_code": "en", "translations": [
						{"lang": "French", "code": "fr", "lang_code": "fr", "sense": "to twine (things) together", "word": "entrelacer"}
					]}
				]
			}`))
		case "/v1/ko/word/intertwine/definitions":
			_, _ = w.Write([]byte(`{
				"word": "intertwine",
				"edition": "ko",
				"definitions": [
					{"pos": "verb", "lang_code": "en", "senses": [
						{"glosses": ["서로 얽히다, 짜다."]}
					]}
				]
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	client := NewWiktAPI(srv.URL)
	result, err := client.Enrich(context.Background(), Request{
		Text:                   "intertwined",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	})
	if err != nil {
		t.Fatalf("Enrich: %v", err)
	}
	if len(result.Entries) == 0 {
		t.Fatalf("expected entries for intertwined, got none")
	}
	if result.Entries[0].Lemma != "intertwined" {
		t.Fatalf("Lemma=%q, want intertwined", result.Entries[0].Lemma)
	}
	filtered := FilterProperSenses(nil, result.Entries[0].Senses, "ko", "intertwined")
	if len(filtered) < 2 {
		t.Fatalf("expected at least 2 senses after FilterProperSenses, got %d (%+v)", len(filtered), filtered)
	}
}

func TestWiktAPITranslateFallsBackToDisplayDefinitions(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/en/word/implicitly/translations":
			_, _ = w.Write([]byte(`{
				"word": "implicitly",
				"edition": "en",
				"translations": [
					{"pos": "adv", "lang_code": "en", "translations": [
						{"lang": "French", "code": "fr", "lang_code": "fr", "sense": "in an implicit or implied manner", "word": "implicitement"}
					]}
				]
			}`))
		case "/v1/ko/word/implicitly/definitions":
			_, _ = w.Write([]byte(`{
				"word": "implicitly",
				"edition": "ko",
				"definitions": [
					{"pos": "unknown", "lang_code": "en", "senses": [
						{"glosses": ["묵시적으로"]}
					]}
				]
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	client := NewWiktAPI(srv.URL)
	res, err := client.Translate(context.Background(), TranslateRequest{
		WordText:     "implicitly",
		LanguageCode: "en",
		DisplayLang:  "ko",
		Senses: []TranslateSenseInput{
			{SenseID: "s-1", Definition: "in an implicit or implied manner"},
		},
	})
	if err != nil {
		t.Fatalf("Translate: %v", err)
	}
	if len(res.Senses) != 1 || res.Senses[0].Definition != "묵시적으로" {
		t.Fatalf("unexpected translate result: %+v", res)
	}
}

