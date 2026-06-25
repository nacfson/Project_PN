// Package enrich turns a bare word into structured dictionary data
// (senses + examples) via an OpenAI-compatible chat-completions endpoint.
//
// The global words/word_senses tables act as a permanent cache, so an
// Enricher is only ever called on a cache miss or an explicit "none of
// these match" forced generation.
package enrich

import "context"

// Example is a single example sentence for a sense.
type Example struct {
	Sentence    string
	Translation string
	Difficulty  string
}

// Sense is one meaning of a word with canonical target-language text and
// optional native-language translations from the initial enrich call.
type Sense struct {
	Definition            string
	ShortDefinition       string
	CEFRLevel             string
	NativeDefinition      string
	NativeShortDefinition string
	Examples              []Example
}

// Entry groups senses that share one part of speech.
type Entry struct {
	Lemma         string
	PartOfSpeech  string
	Pronunciation string
	Senses        []Sense
}

// Result is the full enrichment output for a single word lookup.
type Result struct {
	NormalizedText string
	Entries        []Entry
}

// Request describes what to enrich.
type Request struct {
	Text                   string
	LanguageCode           string
	DefinitionLanguageCode string
	// POS scopes generation to a single part of speech when set to a
	// concrete value. Empty (or "Any") means "all relevant parts of speech".
	POS string
	// Existing lists already-stored sense definitions so the model can
	// return a genuinely new sense for the forced-generation path.
	Existing []string
}

// TranslateExampleInput is a target-language example sentence to translate.
type TranslateExampleInput struct {
	ExampleID string
	Sentence  string
}

// TranslateSenseInput is canonical sense data to translate into displayLang.
type TranslateSenseInput struct {
	SenseID         string
	Definition      string
	ShortDefinition string
	Examples        []TranslateExampleInput
}

// TranslateRequest batches one word's senses for on-demand translation.
type TranslateRequest struct {
	WordText     string
	LanguageCode string
	DisplayLang  string
	Senses       []TranslateSenseInput
}

// TranslateExampleResult is a localized example translation.
type TranslateExampleResult struct {
	ExampleID   string
	Translation string
}

// TranslateSenseResult is a localized sense definition bundle.
type TranslateSenseResult struct {
	SenseID         string
	Definition      string
	ShortDefinition string
	Examples        []TranslateExampleResult
}

// TranslateResult is the on-demand translation output for one word.
type TranslateResult struct {
	Senses []TranslateSenseResult
}

// Enricher produces dictionary data for a word and can translate cached
// canonical content into additional display languages on demand.
type Enricher interface {
	Enrich(ctx context.Context, req Request) (Result, error)
	Translate(ctx context.Context, req TranslateRequest) (TranslateResult, error)
}
