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
}

// Sense is one meaning of a word, in the requested definition language.
type Sense struct {
	Definition      string
	ShortDefinition string
	CEFRLevel       string
	Examples        []Example
}

// Entry groups senses that share one part of speech.
type Entry struct {
	Lemma        string
	PartOfSpeech string
	Senses       []Sense
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

// Enricher produces dictionary data for a word.
type Enricher interface {
	Enrich(ctx context.Context, req Request) (Result, error)
}
