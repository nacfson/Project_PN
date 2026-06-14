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
	return isHangul(r) || isHanOnly(r) || (r >= 0x3040 && r <= 0x30FF)
}

func isHanOnly(r rune) bool {
	return unicode.Is(unicode.Han, r)
}
