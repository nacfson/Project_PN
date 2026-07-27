package learninglog

import (
	"strings"
	"testing"
	"time"
)

func TestQuoteValue(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"charge", "charge"},
		{"en-ko", "en-ko"},
		{"to ask someone to pay", `"to ask someone to pay"`},
		{`say "hi"`, `"say \"hi\""`},
	}
	for _, tc := range tests {
		if got := QuoteValue(tc.in); got != tc.want {
			t.Fatalf("QuoteValue(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestFormatRowFixedOrder(t *testing.T) {
	ts := time.Date(2026, 7, 26, 9, 12, 3, 0, time.UTC)
	row := FormatRow(ts, "learning_item_added", [][2]string{
		{"user_id", "u1"},
		{"lemma", "charge"},
	})
	if !strings.HasPrefix(row, "ts=2026-07-26T09:12:03Z event=learning_item_added ") {
		t.Fatalf("unexpected prefix: %q", row)
	}
	if !strings.Contains(row, "user_id=u1 lemma=charge") {
		t.Fatalf("expected ordered tail, got %q", row)
	}
}
