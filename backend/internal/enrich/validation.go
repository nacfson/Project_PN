package enrich

import (
	"strings"
	"unicode"
)

var latinScriptLangs = map[string]bool{
	"en": true, "es": true, "fr": true, "de": true, "it": true, "pt": true,
	"nl": true, "sv": true, "no": true, "da": true, "fi": true, "pl": true,
	"cs": true, "ro": true, "hu": true, "tr": true, "vi": true, "id": true,
}

var scriptCheckLangs = map[string]func(rune) bool{
	"ko": isHangul,
	"ja": isJapanese,
	"zh": isHanOnly,
}

// ValidTranslation checks whether translation is usable for languageCode when
// compared against the canonical source text. Invalid translations must not
// be cached.
func ValidTranslation(languageCode, source, translation string) bool {
	translation = strings.TrimSpace(translation)
	source = strings.TrimSpace(source)
	if translation == "" {
		return false
	}

	lang := strings.ToLower(strings.TrimSpace(languageCode))
	if latinScriptLangs[lang] && strings.EqualFold(translation, source) {
		return false
	}

	check, ok := scriptCheckLangs[lang]
	if !ok {
		if strings.HasPrefix(lang, "zh") {
			check = isHanOnly
		} else {
			return true
		}
	}

	letters := 0
	matches := 0
	for _, r := range translation {
		if !unicode.IsLetter(r) {
			continue
		}
		letters++
		if check(r) {
			matches++
		}
	}
	if letters == 0 {
		return false
	}
	return float64(matches)/float64(letters) >= 0.25
}

func isHangul(r rune) bool {
	return (r >= 0xAC00 && r <= 0xD7A3) || (r >= 0x1100 && r <= 0x11FF) || (r >= 0x3130 && r <= 0x318F)
}

func isJapanese(r rune) bool {
	return isHanOnly(r) || (r >= 0x3040 && r <= 0x30FF)
}

func isHanOnly(r rune) bool {
	return unicode.Is(unicode.Han, r)
}

// NormalizeMatchText lowercases and collapses whitespace for similarity matching.
func NormalizeMatchText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

// TokenJaccard returns Jaccard similarity of whitespace tokens after NormalizeMatchText.
func TokenJaccard(a, b string) float64 {
	return TokenJaccardExcluding(a, b)
}

func matchTokens(s string) []string {
	fields := strings.Fields(NormalizeMatchText(s))
	out := make([]string, 0, len(fields))
	for _, t := range fields {
		t = strings.TrimFunc(t, func(r rune) bool {
			return unicode.IsPunct(r) || unicode.IsSymbol(r)
		})
		if t != "" {
			out = append(out, t)
		}
	}
	return out
}

// TokenJaccardExcluding is TokenJaccard after dropping each exclude token
// (and every token in a multi-word exclude string) from both sides.
func TokenJaccardExcluding(a, b string, exclude ...string) float64 {
	skip := map[string]struct{}{}
	for _, e := range exclude {
		for _, tok := range matchTokens(e) {
			skip[tok] = struct{}{}
		}
	}
	filter := func(s string) []string {
		out := make([]string, 0)
		for _, t := range matchTokens(s) {
			if _, ok := skip[t]; !ok {
				out = append(out, t)
			}
		}
		return out
	}
	ta := filter(a)
	tb := filter(b)
	if len(ta) == 0 && len(tb) == 0 {
		return 1
	}
	if len(ta) == 0 || len(tb) == 0 {
		return 0
	}
	setA := map[string]struct{}{}
	for _, t := range ta {
		setA[t] = struct{}{}
	}
	inter := 0
	setB := map[string]struct{}{}
	for _, t := range tb {
		setB[t] = struct{}{}
		if _, ok := setA[t]; ok {
			inter++
		}
	}
	union := len(setA) + len(setB) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

func sensesNearDuplicate(a, b Sense) bool {
	if TokenJaccard(a.Definition, b.Definition) >= 0.8 {
		return true
	}
	if a.NativeDefinition != "" && b.NativeDefinition != "" &&
		TokenJaccard(a.NativeDefinition, b.NativeDefinition) >= 0.8 {
		return true
	}
	return false
}

// DedupeSenses keeps the first of each near-dup cluster (Jaccard ≥ 0.8 on
// definition or native definition).
func DedupeSenses(senses []Sense) []Sense {
	out := make([]Sense, 0, len(senses))
	for _, s := range senses {
		dup := false
		for _, kept := range out {
			if sensesNearDuplicate(s, kept) {
				dup = true
				break
			}
		}
		if !dup {
			out = append(out, s)
		}
	}
	return out
}
