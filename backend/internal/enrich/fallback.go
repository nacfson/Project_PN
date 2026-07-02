package enrich

import (
	"context"
	"errors"
	"log/slog"
)

// FallbackEnricher tries a primary Enricher first, then falls back to a
// secondary Enricher on any error (including ErrNotConfigured).
type FallbackEnricher struct {
	primary  Enricher
	fallback Enricher
	logger   *slog.Logger
}

// NewFallback creates a FallbackEnricher. If fallback is nil, errors from
// primary are returned directly with no retry.
func NewFallback(primary, fallback Enricher, logger *slog.Logger) Enricher {
	if logger == nil {
		logger = slog.Default()
	}
	return &FallbackEnricher{
		primary:  primary,
		fallback: fallback,
		logger:   logger,
	}
}

func (f *FallbackEnricher) Enrich(ctx context.Context, req Request) (Result, error) {
	result, err := f.primary.Enrich(ctx, req)
	if err == nil {
		return result, nil
	}
	if f.fallback == nil {
		return Result{}, err
	}
	if errors.Is(err, ErrNotConfigured) {
		f.logger.Debug("enrich: primary not configured, trying fallback")
	} else {
		f.logger.Warn("enrich: primary failed, trying fallback", "primary_error", err)
	}
	return f.fallback.Enrich(ctx, req)
}

func (f *FallbackEnricher) Translate(ctx context.Context, req TranslateRequest) (TranslateResult, error) {
	result, err := f.primary.Translate(ctx, req)
	if err == nil {
		return result, nil
	}
	if f.fallback == nil {
		return TranslateResult{}, err
	}
	if errors.Is(err, ErrNotConfigured) {
		f.logger.Debug("enrich: primary translate not configured, trying fallback")
	} else {
		f.logger.Warn("enrich: primary translate failed, trying fallback", "primary_error", err)
	}
	return f.fallback.Translate(ctx, req)
}
