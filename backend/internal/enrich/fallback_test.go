package enrich

import (
	"context"
	"errors"
	"log/slog"
	"testing"
)

type stubEnricher struct {
	enrichResult    Result
	enrichErr       error
	translateResult TranslateResult
	translateErr    error
	enrichCalled    int
	translateCalled int
}

func (s *stubEnricher) Enrich(_ context.Context, _ Request) (Result, error) {
	s.enrichCalled++
	return s.enrichResult, s.enrichErr
}

func (s *stubEnricher) Translate(_ context.Context, _ TranslateRequest) (TranslateResult, error) {
	s.translateCalled++
	return s.translateResult, s.translateErr
}

func TestFallbackEnricher_PrimarySucceeds(t *testing.T) {
	want := Result{NormalizedText: "hello"}
	primary := &stubEnricher{enrichResult: want}
	fallback := &stubEnricher{enrichResult: Result{NormalizedText: "wrong"}}
	e := NewFallback(primary, fallback, slog.Default())
	got, err := e.Enrich(t.Context(), Request{Text: "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.NormalizedText != want.NormalizedText {
		t.Fatalf("got %q, want %q", got.NormalizedText, want.NormalizedText)
	}
	if fallback.enrichCalled != 0 {
		t.Fatal("fallback should not be called when primary succeeds")
	}
}

func TestFallbackEnricher_PrimaryFailsFallbackSucceeds(t *testing.T) {
	want := Result{NormalizedText: "hello"}
	primary := &stubEnricher{enrichErr: errors.New("primary down")}
	fallback := &stubEnricher{enrichResult: want}
	e := NewFallback(primary, fallback, slog.Default())
	got, err := e.Enrich(t.Context(), Request{Text: "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.NormalizedText != want.NormalizedText {
		t.Fatalf("got %q, want %q", got.NormalizedText, want.NormalizedText)
	}
	if primary.enrichCalled != 1 {
		t.Fatal("primary should be called once")
	}
}

func TestFallbackEnricher_BothFail(t *testing.T) {
	primary := &stubEnricher{enrichErr: errors.New("primary down")}
	fallback := &stubEnricher{enrichErr: errors.New("fallback down")}
	e := NewFallback(primary, fallback, slog.Default())
	_, err := e.Enrich(t.Context(), Request{Text: "hello"})
	if err == nil {
		t.Fatal("expected error when both providers fail")
	}
}

func TestFallbackEnricher_PrimaryNotConfiguredSkipsToFallback(t *testing.T) {
	want := Result{NormalizedText: "hello"}
	primary := &stubEnricher{enrichErr: ErrNotConfigured}
	fallback := &stubEnricher{enrichResult: want}
	e := NewFallback(primary, fallback, slog.Default())
	got, err := e.Enrich(t.Context(), Request{Text: "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.NormalizedText != want.NormalizedText {
		t.Fatalf("got %q, want %q", got.NormalizedText, want.NormalizedText)
	}
}

func TestFallbackEnricher_TranslateFallback(t *testing.T) {
	want := TranslateResult{Senses: []TranslateSenseResult{{SenseID: "s1", Definition: "def"}}}
	primary := &stubEnricher{translateErr: errors.New("primary down")}
	fallback := &stubEnricher{translateResult: want}
	e := NewFallback(primary, fallback, slog.Default())
	got, err := e.Translate(t.Context(), TranslateRequest{WordText: "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got.Senses) != 1 || got.Senses[0].SenseID != "s1" {
		t.Fatalf("unexpected result: %#v", got)
	}
}

func TestFallbackEnricher_NilFallbackReturnsOriginalError(t *testing.T) {
	primary := &stubEnricher{enrichErr: errors.New("primary down")}
	e := NewFallback(primary, nil, slog.Default())
	_, err := e.Enrich(t.Context(), Request{Text: "hello"})
	if err == nil {
		t.Fatal("expected error with nil fallback")
	}
}

func TestFallbackEnricher_PreservesCanonicalResultWhenFallbackFailsOnNoDisplayGloss(t *testing.T) {
	canonical := Result{
		NormalizedText: "ephemeral",
		Entries: []Entry{{
			Lemma:        "ephemeral",
			PartOfSpeech: "adjective",
			Senses:       []Sense{{Definition: "lasting for a very short time"}},
		}},
	}
	primary := &stubEnricher{enrichResult: canonical, enrichErr: ErrNoDisplayGloss}
	fallback := &stubEnricher{enrichErr: ErrUnavailable}
	e := NewFallback(primary, fallback, slog.Default())
	got, err := e.Enrich(t.Context(), Request{Text: "ephemeral"})
	if !errors.Is(err, ErrNoDisplayGloss) {
		t.Fatalf("expected ErrNoDisplayGloss, got %v", err)
	}
	if len(got.Entries) != 1 || got.Entries[0].Senses[0].Definition != "lasting for a very short time" {
		t.Fatalf("expected canonical entries preserved, got %+v", got)
	}
}

func TestFallbackEnricher_UsesFallbackOnNoDisplayGlossWhenFallbackSucceeds(t *testing.T) {
	canonical := Result{
		NormalizedText: "ephemeral",
		Entries: []Entry{{
			Lemma:        "ephemeral",
			PartOfSpeech: "adjective",
			Senses:       []Sense{{Definition: "lasting for a very short time"}},
		}},
	}
	translated := Result{
		NormalizedText: "ephemeral",
		Entries: []Entry{{
			Lemma:        "ephemeral",
			PartOfSpeech: "adjective",
			Senses:       []Sense{{Definition: "lasting for a very short time", NativeDefinition: "단명하는", NativeShortDefinition: "일시적인"}},
		}},
	}
	primary := &stubEnricher{enrichResult: canonical, enrichErr: ErrNoDisplayGloss}
	fallback := &stubEnricher{enrichResult: translated}
	e := NewFallback(primary, fallback, slog.Default())
	got, err := e.Enrich(t.Context(), Request{Text: "ephemeral"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Entries[0].Senses[0].NativeShortDefinition != "일시적인" {
		t.Fatalf("expected fallback translation, got %+v", got)
	}
}
