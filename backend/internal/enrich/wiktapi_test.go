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
