package enrich

import "strings"

func firstNonEmptyGloss(values ...string) string {
	for _, v := range values {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func nearExistingText(existing []string, candidates ...string) bool {
	for _, e := range existing {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		for _, c := range candidates {
			c = strings.TrimSpace(c)
			if c == "" {
				continue
			}
			if TokenJaccard(e, c) >= 0.8 {
				return true
			}
		}
	}
	return false
}

// FilterProperSenses keeps incoming senses that are non-empty, distinct from
// existing catalog text, and have a simple display-language gloss. Near-dups
// inside the batch are collapsed first. Survivors have NativeShortDefinition
// set to the simple gloss.
func FilterProperSenses(existing []string, incoming []Sense, displayLang string) []Sense {
	displayLang = strings.ToLower(strings.TrimSpace(displayLang))
	deduped := DedupeSenses(incoming)
	matchTexts := append([]string{}, existing...)
	out := make([]Sense, 0, len(deduped))

	for _, sense := range deduped {
		if strings.TrimSpace(sense.Definition) == "" {
			continue
		}
		native := firstNonEmptyGloss(sense.NativeShortDefinition, sense.NativeDefinition)
		if native == "" {
			continue
		}
		if displayLang != "" && !ValidTranslation(displayLang, sense.Definition, native) {
			continue
		}
		simple := PreferSimpleGloss(sense.NativeShortDefinition, sense.NativeDefinition)
		if !IsSimpleGloss(simple) {
			continue
		}
		if nearExistingText(matchTexts, sense.Definition, sense.NativeDefinition, sense.NativeShortDefinition, simple) {
			continue
		}
		sense.NativeShortDefinition = simple
		if strings.TrimSpace(sense.NativeDefinition) == "" {
			sense.NativeDefinition = simple
		}
		out = append(out, sense)
		matchTexts = append(matchTexts, sense.Definition, sense.NativeDefinition, simple)
	}
	return out
}
