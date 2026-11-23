package enrich

import (
	"context"
	"errors"
	"fmt"
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
	primaryResult, primaryErr := f.primary.Enrich(ctx, req)
	if primaryErr == nil {
		return primaryResult, nil
	}
	if f.fallback == nil {
		return primaryResult, primaryErr
	}
	if errors.Is(primaryErr, ErrNotConfigured) {
		f.logger.Debug("enrich: primary not configured, trying fallback")
	} else {
		f.logger.Warn("enrich: primary failed, trying fallback", "primary_error", primaryErr)
	}
	fallbackResult, fallbackErr := f.fallback.Enrich(ctx, req)
	if fallbackErr == nil {
		return fallbackResult, nil
	}
	if errors.Is(fallbackErr, ErrNotConfigured) {
		return primaryResult, primaryErr
	}
	if errors.Is(primaryErr, ErrNoDisplayGloss) && len(primaryResult.Entries) > 0 {
		return primaryResult, fmt.Errorf("%w (fallback failed: %v)", primaryErr, fallbackErr)
	}
	return Result{}, fallbackErr
}

func (f *FallbackEnricher) Translate(ctx context.Context, req TranslateRequest) (TranslateResult, error) {
	primaryResult, primaryErr := f.primary.Translate(ctx, req)
	if primaryErr == nil {
		return primaryResult, nil
	}
	if f.fallback == nil {
		return TranslateResult{}, primaryErr
	}
	if errors.Is(primaryErr, ErrNotConfigured) {
		f.logger.Debug("enrich: primary translate not configured, trying fallback")
	} else {
		f.logger.Warn("enrich: primary translate failed, trying fallback", "primary_error", primaryErr)
	}
	fallbackResult, fallbackErr := f.fallback.Translate(ctx, req)
	if fallbackErr == nil {
		return fallbackResult, nil
	}
	if errors.Is(fallbackErr, ErrNotConfigured) {
		return TranslateResult{}, primaryErr
	}
	return TranslateResult{}, fallbackErr
}
