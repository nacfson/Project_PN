package words

import (
	"fmt"
	"strings"

	"project-pn/internal/enrich"
)

// phraseDraftEntry builds a minimal enrich entry so multi-word phrases can still
// be added to private decks when WiktApi misses and no LLM key is configured.
// The draft is a real shared word_sense (POS phrase) with a usable gloss; force
// generate / LLM enrich can append better senses later when available.
func phraseDraftEntry(lemma, posHint, sourceContext, _ string) enrich.Entry {
	lemma = strings.TrimSpace(lemma)
	pos := strings.ToLower(strings.TrimSpace(posHint))
	if pos == "" || pos == "any" {
		pos = "phrase"
	}

	def := strings.TrimSpace(sourceContext)
	if def == "" {
		def = fmt.Sprintf("Multi-word phrase: %s", lemma)
	}
	short := lemma

	// Without an enricher we cannot translate. Mirror a compact English gloss into
	// the display-language row so AddLearningItem can require sense_translations.
	nativeDef := def
	nativeShort := short

	return enrich.Entry{
		Lemma:        lemma,
		PartOfSpeech: pos,
		Senses: []enrich.Sense{
			{
				Definition:            def,
				ShortDefinition:       short,
				NativeDefinition:      nativeDef,
				NativeShortDefinition: nativeShort,
			},
		},
	}
}
