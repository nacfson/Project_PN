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
