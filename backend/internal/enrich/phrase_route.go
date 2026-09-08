package enrich

import (
	"context"
	"log/slog"
	"strings"
)

// IsMultiWordLemma reports whether text is a multi-word phrase / expression.
func IsMultiWordLemma(text string) bool {
	return len(strings.Fields(strings.TrimSpace(text))) > 1
}

// PhrasePreferLLM routes enrichment so multi-word phrases try the LLM first
// (WiktApi usually 404s on phrases) while single words still prefer free WiktApi.
type PhrasePreferLLM struct {
	dictionary Enricher // typically WiktApi
	llm        Enricher // Gemini/OpenAI chain
	logger     *slog.Logger
}

// NewPhrasePreferLLM builds a phrase-aware enricher. llm may be nil.
func NewPhrasePreferLLM(dictionary, llm Enricher, logger *slog.Logger) Enricher {
	if logger == nil {
		logger = slog.Default()
	}
	if llm == nil {
		return dictionary
	}
	return &PhrasePreferLLM{
		dictionary: dictionary,
		llm:        llm,
		logger:     logger,
	}
}

func (p *PhrasePreferLLM) Enrich(ctx context.Context, req Request) (Result, error) {
	if IsMultiWordLemma(req.Text) {
		p.logger.Info("enrich: multi-word phrase, trying LLM first", "text", req.Text)
		result, err := p.llm.Enrich(ctx, req)
		if err == nil {
			return result, nil
		}
		p.logger.Warn("enrich: phrase LLM failed, trying dictionary", "text", req.Text, "error", err)
		return p.dictionary.Enrich(ctx, req)
	}
	result, err := p.dictionary.Enrich(ctx, req)
	if err == nil {
		return result, nil
	}
	p.logger.Warn("enrich: dictionary missed, trying LLM", "text", req.Text, "error", err)
	return p.llm.Enrich(ctx, req)
}

func (p *PhrasePreferLLM) Translate(ctx context.Context, req TranslateRequest) (TranslateResult, error) {
	if IsMultiWordLemma(req.WordText) {
		result, err := p.llm.Translate(ctx, req)
		if err == nil {
			return result, nil
		}
		return p.dictionary.Translate(ctx, req)
	}
	result, err := p.dictionary.Translate(ctx, req)
	if err == nil {
		return result, nil
	}
	return p.llm.Translate(ctx, req)
}
