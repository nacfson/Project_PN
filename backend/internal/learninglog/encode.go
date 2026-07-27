package learninglog

import (
	"strings"
	"time"
	"unicode"
)

func safeValueRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '.' || r == ':' || r == '-'
}

func QuoteValue(s string) string {
	if s == "" {
		return `""`
	}
	for _, r := range s {
		if !safeValueRune(r) {
			return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
		}
	}
	return s
}

func FormatRow(ts time.Time, event string, fields [][2]string) string {
	parts := make([]string, 0, 2+len(fields))
	parts = append(parts, "ts="+ts.UTC().Format(time.RFC3339))
	parts = append(parts, "event="+QuoteValue(event))
	for _, kv := range fields {
		parts = append(parts, kv[0]+"="+QuoteValue(kv[1]))
	}
	return strings.Join(parts, " ")
}
