# Enrich

## Overview
Produces structured dictionary entries (parts of speech, senses, glosses, and optional example sentences) and on-demand display-language translations for cache misses in the global vocabulary catalog. Combines a free Wiktionary/WiktApi gloss provider (`WiktAPI`), an OpenAI-compatible chat-completions LLM provider (`OpenAIEnricher`), a primary-with-fallback wrapper (`FallbackEnricher`), and shared gloss simplification, script validation, and near-duplicate sense filtering utilities.

## Interface
- Core contract & DTOs: `Enricher` (`Enrich`, `Translate`), `Request`, `Result`, `Entry`, `Sense`, `Example`, `TranslateRequest`, `TranslateSenseInput`, `TranslateExampleInput`, `TranslateResult`, `TranslateSenseResult`, `TranslateExampleResult` `[enrich.go:Enricher]`, `[enrich.go:Request]`, `[enrich.go:Result]`, `[enrich.go:TranslateRequest]`, `[enrich.go:TranslateResult]`
- Providers & fallback:
  - `WiktAPI`, `NewWiktAPI(baseURL string) *WiktAPI`, `(*WiktAPI).Enrich`, `(*WiktAPI).Translate` `[wiktapi.go:WiktAPI]`, `[wiktapi.go:NewWiktAPI]`, `[wiktapi.go:Enrich]`, `[wiktapi.go:Translate]`
  - `OpenAIEnricher`, `NewOpenAI(baseURL, model string) *OpenAIEnricher`, `(*OpenAIEnricher).Enrich`, `(*OpenAIEnricher).Translate` `[openai.go:OpenAIEnricher]`, `[openai.go:NewOpenAI]`, `[openai.go:Enrich]`, `[openai.go:Translate]`
  - `FallbackEnricher`, `NewFallback(primary, fallback Enricher, logger *slog.Logger) Enricher` `[fallback.go:FallbackEnricher]`, `[fallback.go:NewFallback]`
- Sentinel errors: `ErrNotConfigured`, `ErrInvalidOutput`, `ErrUnsupportedLanguage`, `ErrUnavailable`, `ErrNoAdditionalSenses` `[openai.go:ErrNotConfigured]`, `[openai.go:ErrInvalidOutput]`, `[openai.go:ErrUnsupportedLanguage]`, `[openai.go:ErrUnavailable]`, `[openai.go:ErrNoAdditionalSenses]`
- Filtering, gloss simplification & validation:
  - `FilterProperSenses(existing []string, incoming []Sense, displayLang, lemma string) []Sense` `[filter.go:FilterProperSenses]`
  - `IsMultiWordLemma`, `IsPhrasePatternGloss`, `IsSimpleGloss`, `IsSimplePhraseGloss`, `ExtractKoreanHeadword`, `PreferSimpleGloss`, `PreferSimpleGlossForLemma` `[gloss.go:IsMultiWordLemma]`, `[gloss.go:IsSimpleGloss]`, `[gloss.go:IsSimplePhraseGloss]`, `[gloss.go:PreferSimpleGlossForLemma]`
  - `ValidTranslation`, `NormalizeMatchText`, `TokenJaccard`, `TokenJaccardExcluding`, `DedupeSenses` `[validation.go:ValidTranslation]`, `[validation.go:TokenJaccard]`, `[validation.go:TokenJaccardExcluding]`, `[validation.go:DedupeSenses]`

## Invariants
- `(*OpenAIEnricher).Enrich` and `Translate` return `ErrNotConfigured` when `BaseURL` or `Model` is empty, and `ErrUnsupportedLanguage` when configured with an English-only fallback model (`english-dictionary-fallback-v1`, `dictionary-ko-v1`) for non-`"en"` requests `[openai.go:Enrich]`, `[openai.go:Translate]`, `[openai.go:isEnglishDictionaryFallback]`.
- `parseModelOutput` verifies `normalized_text` and every entry's `lemma` match the requested word, forces `part_of_speech = "phrase"` for multi-word lemmas, requires at least one usable example sentence per sense (keeping exactly the first), validates translations via `ValidTranslation`, deduplicates near-duplicate senses (Jaccard `>= 0.8`), and returns `ErrInvalidOutput` if no usable entries remain `[openai.go:parseModelOutput]`, `[validation.go:DedupeSenses]`.
- `ValidTranslation` rejects empty strings, identical Latin-script echoes, and CJK (`ko`, `ja`, `zh*`) strings where fewer than 25% of letter runes match the target script `[validation.go:ValidTranslation]`.
- `FilterProperSenses` collapses intra-batch near-duplicates, requires non-empty definition and valid simple gloss (preserving compact `~…` usage patterns for multi-word lemmas via `IsSimplePhraseGloss` while using headword extraction for single words), and rejects candidates with `TokenJaccard >= 0.8` against existing catalog texts `[filter.go:FilterProperSenses]`, `[gloss.go:PreferSimpleGlossForLemma]`.
- `(*WiktAPI).Enrich` queries WiktApi translations and display-language definitions (with English stem fallback via `englishStemCandidates`), skips glosses already in `req.Existing`, forces `"phrase"` POS for multi-word lemmas, and distinguishes `ErrNoAdditionalSenses` from `ErrUnavailable` `[wiktapi.go:Enrich]`, `[wiktapi.go:collectGlossRows]`, `[wiktapi.go:englishStemCandidates]`.
- `(*FallbackEnricher).Enrich` and `Translate` invoke `fallback` on any error from `primary` (including `ErrNotConfigured`), or return the primary error directly when `fallback == nil` `[fallback.go:Enrich]`, `[fallback.go:Translate]`.

## Side Effects
- Performs outbound HTTP `POST` calls to `<BaseURL>/chat/completions` (30s timeout, 1 MiB response cap) in `OpenAIEnricher` `[openai.go:NewOpenAI]`, `[openai.go:complete]`.
- Performs outbound HTTP `GET` calls to `<baseURL>/v1/en/word/<lemma>/translations` and `<baseURL>/v1/<edition>/word/<lemma>/definitions` (20s timeout, 8 MiB response cap, default `https://api.wiktapi.dev`) in `WiktAPI` `[wiktapi.go:NewWiktAPI]`, `[wiktapi.go:fetchTranslations]`, `[wiktapi.go:fetchDefinitions]`, `[wiktapi.go:getJSON]`.
- Logs provider failures, fallback transitions, and translation count mismatches via `slog` `[fallback.go:Enrich]`, `[openai.go:complete]`, `[openai.go:parseTranslateOutput]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/enrich` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
