package enrich

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
)

func TestPhrasePreferLLMRoutesMultiWordToLLMFirst(t *testing.T) {
	dict := &stubEnricher{enrichErr: errors.New("should not call dict first")}
	llm := &stubEnricher{enrichResult: Result{Entries: []Entry{{PartOfSpeech: "llm"}}}}
	router := NewPhrasePreferLLM(dict, llm, slog.New(slog.NewTextHandler(io.Discard, nil)))
	res, err := router.Enrich(context.Background(), Request{Text: "in which"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Entries[0].PartOfSpeech != "llm" {
		t.Fatalf("got POS %q want llm", res.Entries[0].PartOfSpeech)
	}
	if dict.enrichCalled != 0 {
		t.Fatalf("dictionary called %d times", dict.enrichCalled)
	}
	if llm.enrichCalled != 1 {
		t.Fatalf("llm called %d times", llm.enrichCalled)
	}
}

func TestPhrasePreferLLMUsesDictionaryForSingleWord(t *testing.T) {
	dict := &stubEnricher{enrichResult: Result{Entries: []Entry{{PartOfSpeech: "dict"}}}}
	llm := &stubEnricher{enrichErr: errors.New("should not call llm")}
	router := NewPhrasePreferLLM(dict, llm, slog.New(slog.NewTextHandler(io.Discard, nil)))
	res, err := router.Enrich(context.Background(), Request{Text: "charge"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Entries[0].PartOfSpeech != "dict" {
		t.Fatalf("got POS %q want dict", res.Entries[0].PartOfSpeech)
	}
	if llm.enrichCalled != 0 {
		t.Fatalf("llm called %d times", llm.enrichCalled)
	}
}

func TestPhrasePreferLLMFallsBackToDictionaryWhenLLMFails(t *testing.T) {
	dict := &stubEnricher{enrichResult: Result{Entries: []Entry{{PartOfSpeech: "dict"}}}}
	llm := &stubEnricher{enrichErr: errors.New("llm down")}
	router := NewPhrasePreferLLM(dict, llm, slog.New(slog.NewTextHandler(io.Discard, nil)))
	res, err := router.Enrich(context.Background(), Request{Text: "look up"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Entries[0].PartOfSpeech != "dict" {
		t.Fatalf("got POS %q want dict", res.Entries[0].PartOfSpeech)
	}
}
