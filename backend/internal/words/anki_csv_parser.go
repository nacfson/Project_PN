package words

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"golang.org/x/net/html"
)

// ParseAnkiCSV parses an Anki CSV/TXT export into a slice of AnkiCard.
// It strips HTML tags, removes the UTF-8 BOM if present, and expects at least
// "Front" and "Back" columns. The "Tags" column is optional.
func ParseAnkiCSV(r io.Reader) ([]AnkiCard, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("anki import: read input: %w", err)
	}

	// Strip UTF-8 BOM if present.
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})

	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1 // Allow variable columns.
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("anki import: parse csv: %w", err)
	}
	if len(records) == 0 {
		return nil, nil
	}

	frontIdx, backIdx, tagsIdx := locateColumns(records[0])
	if frontIdx < 0 || backIdx < 0 {
		return nil, fmt.Errorf("anki import: CSV must contain 'Front' and 'Back' columns")
	}

	var cards []AnkiCard
	for i, row := range records[1:] {
		if len(row) <= max(frontIdx, backIdx) {
			continue
		}
		front := stripHTML(row[frontIdx])
		back := stripHTML(row[backIdx])
		if strings.TrimSpace(front) == "" || strings.TrimSpace(back) == "" {
			continue
		}
		card := AnkiCard{
			Front: front,
			Back:  back,
		}
		if tagsIdx >= 0 && tagsIdx < len(row) {
			card.Tags = strings.TrimSpace(row[tagsIdx])
		}
		cards = append(cards, card)
		_ = i
	}
	return cards, nil
}

func locateColumns(header []string) (frontIdx, backIdx, tagsIdx int) {
	frontIdx, backIdx, tagsIdx = -1, -1, -1
	for i, h := range header {
		h = strings.TrimSpace(strings.ToLower(h))
		switch h {
		case "front":
			frontIdx = i
		case "back":
			backIdx = i
		case "tags":
			tagsIdx = i
		}
	}
	return
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// stripHTML removes HTML tags and returns plain text. It uses golang.org/x/net/html
// so nested tags and entities are handled correctly.
func stripHTML(input string) string {
	input = strings.TrimSpace(input)
	if input == "" {
		return ""
	}
	doc, err := html.Parse(strings.NewReader(input))
	if err != nil {
		// Fallback: regex-like strip of <...> on parse failure.
		var b strings.Builder
		inTag := false
		for _, r := range input {
			if r == '<' {
				inTag = true
				continue
			}
			if r == '>' {
				inTag = false
				continue
			}
			if !inTag {
				b.WriteRune(r)
			}
		}
		return strings.TrimSpace(b.String())
	}

	var text strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			text.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return strings.TrimSpace(text.String())
}
