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

// IsSimpleGloss reports whether text is already a short headword-style gloss
// (덮다, 사과, "leave behind") rather than a dictionary paraphrase.
func IsSimpleGloss(text string) bool {
	value := trimMeaning(text)
	if value == "" {
		return false
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
// strips a leading "To ".
func PreferSimpleGloss(shortText, fullText string) string {
	shortValue := trimMeaning(shortText)
	if IsSimpleGloss(shortValue) {
		return shortValue
	}
	fullValue := trimMeaning(fullText)
	if IsSimpleGloss(fullValue) {
		return fullValue
	}
	if head := ExtractKoreanHeadword(firstNonEmpty(shortValue, fullValue)); head != "" {
		return head
	}
	if verb := simplifyEnglishGloss(firstNonEmpty(shortValue, fullValue)); verb != "" {
		return verb
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
