package words

import (
	"strings"
	"testing"
)

func TestParseAnkiCSV_Basic(t *testing.T) {
	input := `Front,Back,Tags
run,to move quickly,verbs
eat,to consume food,verbs
book,a set of pages,nouns`

	cards, err := ParseAnkiCSV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cards) != 3 {
		t.Fatalf("expected 3 cards, got %d", len(cards))
	}
	if cards[0].Front != "run" || cards[0].Back != "to move quickly" || cards[0].Tags != "verbs" {
		t.Errorf("unexpected first card: %+v", cards[0])
	}
}

func TestParseAnkiCSV_StripsHTML(t *testing.T) {
	input := `Front,Back
<b>run</b>,<div>to move <i>quickly</i></div>`

	cards, err := ParseAnkiCSV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cards) != 1 {
		t.Fatalf("expected 1 card, got %d", len(cards))
	}
	if cards[0].Front != "run" {
		t.Errorf("expected front 'run', got %q", cards[0].Front)
	}
	if cards[0].Back != "to move quickly" {
		t.Errorf("expected back 'to move quickly', got %q", cards[0].Back)
	}
}

func TestParseAnkiCSV_BOM(t *testing.T) {
	input := "\xef\xbb\xbfFront,Back\nrun,to move quickly"

	cards, err := ParseAnkiCSV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cards) != 1 {
		t.Fatalf("expected 1 card, got %d", len(cards))
	}
	if cards[0].Front != "run" {
		t.Errorf("expected front 'run', got %q", cards[0].Front)
	}
}

func TestParseAnkiCSV_EmptyRowsSkipped(t *testing.T) {
	input := `Front,Back
run,to move quickly
,
walk,to travel on foot`

	cards, err := ParseAnkiCSV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cards) != 2 {
		t.Fatalf("expected 2 cards, got %d", len(cards))
	}
}

func TestFindBestMatchingSense(t *testing.T) {
	options := []SenseOption{
		{WordSenseID: "a", Definition: "to move quickly on foot"},
		{WordSenseID: "b", Definition: "to operate or manage"},
	}

	matched := findBestMatchingSense(options, "to move quickly")
	if matched == nil || matched.WordSenseID != "a" {
		t.Errorf("expected sense a, got %+v", matched)
	}

	if findBestMatchingSense(options, "totally unrelated") != nil {
		t.Error("expected no match")
	}
}
