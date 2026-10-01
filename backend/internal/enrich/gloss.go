package enrich

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

var hangulToken = regexp.MustCompile(`[\x{AC00}-\x{D7A3}]+`)
var koreanCommaList = regexp.MustCompile(`^[\x{AC00}-\x{D7A3}]+(?:\s*,\s*[\x{AC00}-\x{D7A3}]+)+$`)
var englishToVerb = regexp.MustCompile(`(?i)^to\s+([a-z]+)`)

func trimMeaning(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimRight(value, ".。")
	return strings.TrimSpace(value)
}

func hangulTokens(text string) []string {
	return hangulToken.FindAllString(text, -1)
}

// IsMultiWordLemma reports whether text is a multi-token phrase after trim.
func IsMultiWordLemma(text string) bool {
	return len(strings.Fields(strings.TrimSpace(text))) > 1
}

// IsPhrasePatternGloss reports compact multi-word / function-expression glosses
// such as "~하는 데", "~인 경우에", "~하는 방식으로". These are valid for phrases
// but must not be hollow-extracted to a trailing token like "데".
func IsPhrasePatternGloss(text string) bool {
	value := trimMeaning(text)
	if value == "" {
		return false
	}
	if !strings.Contains(value, "~") && !strings.Contains(value, "…") {
		return false
	}
	korean := hangulTokens(value)
	if len(korean) == 0 || len(korean) > 4 {
		return false
	}
	if utf8.RuneCountInString(value) > 40 {
		return false
	}
	// Reject long dictionary-style paraphrases that happen to include "~".
	if strings.Contains(value, "무엇을") || strings.Contains(value, "등으로") {
		return false
	}
	return true
}

// IsSimpleGloss reports whether text is already a short headword-style gloss
// (덮다, 사과, "leave behind") or a compact phrase pattern ("~하는 데"),
// rather than a dictionary paraphrase.
func IsSimpleGloss(text string) bool {
	value := trimMeaning(text)
	if value == "" {
		return false
	}
	if IsPhrasePatternGloss(value) {
		return true
	}
	korean := hangulTokens(value)
	if len(korean) == 1 {
		return true
	}
	if len(korean) > 1 {
		return len(korean) <= 3 && koreanCommaList.MatchString(value)
	}
	words := strings.Fields(value)
	if len(words) == 0 || len(words) > 4 {
		return false
	}
	if strings.HasPrefix(strings.ToLower(value), "to ") {
		return false
	}
	return utf8.RuneCountInString(value) <= 40
}

// IsSimplePhraseGloss reports whether text is an acceptable short gloss for a
// multi-word lemma, including compact ~… usage patterns such as "~하는 데".
func IsSimplePhraseGloss(text string) bool {
	value := trimMeaning(text)
	if value == "" {
		return false
	}
	if IsSimpleGloss(value) {
		return true
	}
	if !(strings.Contains(value, "~") || strings.Contains(value, "～")) {
		// Short multi-token Korean/English usage glosses without tilde.
		words := strings.Fields(value)
		if len(words) == 0 || len(words) > 5 {
			return false
		}
		if utf8.RuneCountInString(value) > 40 {
			return false
		}
		if strings.HasPrefix(strings.ToLower(value), "to ") {
			return false
		}
		korean := hangulTokens(value)
		return len(korean) > 0 && len(korean) <= 4
	}
	words := strings.Fields(value)
	if len(words) > 6 {
		return false
	}
	return utf8.RuneCountInString(value) <= 40
}

// ExtractKoreanHeadword returns the last Hangul token, e.g. 덮다 from
// "흙이나 눈 등으로 ~을 덮다".
func ExtractKoreanHeadword(text string) string {
	tokens := hangulTokens(trimMeaning(text))
	if len(tokens) == 0 {
		return ""
	}
	return tokens[len(tokens)-1]
}

// PreferSimpleGloss returns a 1–3 word headword when short or full text is a
// long dictionary explanation. Korean extracts the final predicate; English
// strips a leading "To ". Phrase-pattern glosses with "~" / "…" are kept intact.
func PreferSimpleGloss(shortText, fullText string) string {
	shortValue := trimMeaning(shortText)
	if IsSimpleGloss(shortValue) {
		return shortValue
	}
	fullValue := trimMeaning(fullText)
	if IsSimpleGloss(fullValue) {
		return fullValue
	}
	combined := firstNonEmpty(shortValue, fullValue)
	// Do not hollow-extract "~하는 데" → "데".
	if strings.Contains(combined, "~") || strings.Contains(combined, "…") {
		return combined
	}
	if head := ExtractKoreanHeadword(combined); head != "" {
		return head
	}
	if verb := simplifyEnglishGloss(combined); verb != "" {
		return verb
	}
	return combined
}

// PreferSimpleGlossForLemma prefers headword simplification for single words,
// but keeps compact phrase usage patterns for multi-word lemmas so patterns
// like "~하는 데" are not mangled to the last Hangul token ("데").
func PreferSimpleGlossForLemma(lemma, shortText, fullText string) string {
	if !IsMultiWordLemma(lemma) {
		return PreferSimpleGloss(shortText, fullText)
	}
	shortValue := trimMeaning(shortText)
	if IsSimplePhraseGloss(shortValue) {
		return shortValue
	}
	fullValue := trimMeaning(fullText)
	if IsSimplePhraseGloss(fullValue) {
		return fullValue
	}
	return firstNonEmpty(shortValue, fullValue)
}

func simplifyEnglishGloss(text string) string {
	if text == "" || IsSimpleGloss(text) {
		return text
	}
	m := englishToVerb.FindStringSubmatch(text)
	if len(m) == 2 {
		return strings.ToLower(m[1])
	}
	return ""
}
