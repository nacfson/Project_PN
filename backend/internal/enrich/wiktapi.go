package enrich

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"
)

const defaultWiktAPIBaseURL = "https://api.wiktapi.dev"

// WiktAPI looks up EN→display-language glosses via public WiktApi (Kaikki/Wiktionary).
// No API key is required. It implements Enricher for the gloss-only product path.
type WiktAPI struct {
	baseURL    string
	httpClient *http.Client
}

// NewWiktAPI builds a WiktApi enricher. Empty baseURL uses https://api.wiktapi.dev.
func NewWiktAPI(baseURL string) *WiktAPI {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = defaultWiktAPIBaseURL
	}
	return &WiktAPI{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

type wiktTranslationsResponse struct {
	Word         string `json:"word"`
	Translations []struct {
		POS          string `json:"pos"`
		Translations []struct {
			LangCode string `json:"lang_code"`
			Code     string `json:"code"`
			Lang     string `json:"lang"`
			Sense    string `json:"sense"`
			Word     string `json:"word"`
		} `json:"translations"`
	} `json:"translations"`
}

// Enrich fetches KO (or other display-language) glosses for the lemma and maps
// each unique gloss to one sense. Examples are not generated.
func (w *WiktAPI) Enrich(ctx context.Context, req Request) (Result, error) {
	lemma := strings.TrimSpace(req.Text)
	if lemma == "" {
		return Result{}, fmt.Errorf("%w: empty word", ErrUnavailable)
	}
	displayLang := strings.ToLower(strings.TrimSpace(req.DefinitionLanguageCode))
	if displayLang == "" {
		displayLang = "ko"
	}

	raw, err := w.fetchTranslations(ctx, lemma)
	if err != nil {
		return Result{}, err
	}

	existing := map[string]struct{}{}
	for _, e := range req.Existing {
		existing[normalizeGlossKey(e)] = struct{}{}
	}

	posFilter := strings.ToLower(strings.TrimSpace(req.POS))
	if posFilter == "any" {
		posFilter = ""
	}

	type glossRow struct {
		pos   string
		sense string
		gloss string
	}
	var rows []glossRow
	seenGloss := map[string]struct{}{}

	for _, block := range raw.Translations {
		pos := normalizePOS(block.POS)
		if pos == "" {
			continue
		}
		if IsMultiWordLemma(lemma) {
			pos = "phrase"
		}
		if posFilter != "" && pos != posFilter {
			continue
		}
		for _, t := range block.Translations {
			if !matchesDisplayLang(t.LangCode, t.Code, t.Lang, displayLang) {
				continue
			}
			gloss := cleanGloss(t.Word)
			if gloss == "" {
				continue
			}
			key := pos + "\x00" + normalizeGlossKey(gloss)
			if _, ok := seenGloss[key]; ok {
				continue
			}
			if _, skip := existing[normalizeGlossKey(gloss)]; skip {
				continue
			}
			if _, skip := existing[normalizeGlossKey(t.Sense)]; skip {
				continue
			}
			seenGloss[key] = struct{}{}
			rows = append(rows, glossRow{pos: pos, sense: strings.TrimSpace(t.Sense), gloss: gloss})
		}
	}

	if len(rows) == 0 {
		if len(existing) > 0 || posFilter != "" {
			return Result{}, fmt.Errorf("%w: no new %s glosses for %q", ErrNoAdditionalSenses, displayLang, lemma)
		}
		return Result{}, fmt.Errorf("%w: no %s glosses for %q", ErrUnavailable, displayLang, lemma)
	}

	byPOS := map[string]*Entry{}
	var order []string
	for _, row := range rows {
		entry, ok := byPOS[row.pos]
		if !ok {
			entry = &Entry{
				Lemma:        firstNonEmpty(raw.Word, lemma),
				PartOfSpeech: row.pos,
			}
			byPOS[row.pos] = entry
			order = append(order, row.pos)
		}
		def := row.sense
		if def == "" {
			def = row.gloss
		}
		short := row.gloss
		entry.Senses = append(entry.Senses, Sense{
			Definition:            def,
			ShortDefinition:       short,
			NativeDefinition:      row.gloss,
			NativeShortDefinition: row.gloss,
		})
	}

	entries := make([]Entry, 0, len(order))
	for _, pos := range order {
		entries = append(entries, *byPOS[pos])
	}
	return Result{
		NormalizedText: strings.ToLower(strings.Join(strings.Fields(lemma), " ")),
		Entries:        entries,
	}, nil
}

// Translate re-queries WiktApi and assigns display glosses to senses by matching
// English sense text or falling back to ordered unused glosses.
func (w *WiktAPI) Translate(ctx context.Context, req TranslateRequest) (TranslateResult, error) {
	displayLang := strings.ToLower(strings.TrimSpace(req.DisplayLang))
	if displayLang == "" {
		return TranslateResult{}, fmt.Errorf("%w: empty display language", ErrUnavailable)
	}
	lemma := strings.TrimSpace(req.WordText)
	if lemma == "" || len(req.Senses) == 0 {
		return TranslateResult{}, nil
	}

	raw, err := w.fetchTranslations(ctx, lemma)
	if err != nil {
		return TranslateResult{}, err
	}

	type pair struct {
		sense string
		gloss string
	}
	var pairs []pair
	seen := map[string]struct{}{}
	for _, block := range raw.Translations {
		for _, t := range block.Translations {
			if !matchesDisplayLang(t.LangCode, t.Code, t.Lang, displayLang) {
				continue
			}
			gloss := cleanGloss(t.Word)
			if gloss == "" {
				continue
			}
			key := normalizeGlossKey(gloss) + "\x00" + normalizeGlossKey(t.Sense)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			pairs = append(pairs, pair{sense: strings.TrimSpace(t.Sense), gloss: gloss})
		}
	}
	if len(pairs) == 0 {
		return TranslateResult{}, fmt.Errorf("%w: no %s glosses for %q", ErrUnavailable, displayLang, lemma)
	}

	used := map[int]struct{}{}
	out := TranslateResult{Senses: make([]TranslateSenseResult, 0, len(req.Senses))}
	for _, sense := range req.Senses {
		gloss := ""
		defKey := normalizeGlossKey(sense.Definition)
		shortKey := normalizeGlossKey(sense.ShortDefinition)
		for i, p := range pairs {
			if _, taken := used[i]; taken {
				continue
			}
			senseKey := normalizeGlossKey(p.sense)
			glossKey := normalizeGlossKey(p.gloss)
			if (senseKey != "" && (senseKey == defKey || senseKey == shortKey)) ||
				(glossKey != "" && (glossKey == defKey || glossKey == shortKey)) {
				gloss = p.gloss
				used[i] = struct{}{}
				break
			}
		}
		if gloss == "" {
			for i, p := range pairs {
				if _, taken := used[i]; taken {
					continue
				}
				gloss = p.gloss
				used[i] = struct{}{}
				break
			}
		}
		if gloss == "" {
			continue
		}
		out.Senses = append(out.Senses, TranslateSenseResult{
			SenseID:         sense.SenseID,
			Definition:      gloss,
			ShortDefinition: gloss,
		})
	}
	if len(out.Senses) == 0 {
		return TranslateResult{}, fmt.Errorf("%w: could not map glosses for %q", ErrUnavailable, lemma)
	}
	return out, nil
}

func (w *WiktAPI) fetchTranslations(ctx context.Context, lemma string) (wiktTranslationsResponse, error) {
	endpoint := fmt.Sprintf("%s/v1/en/word/%s/translations", w.baseURL, url.PathEscape(lemma))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return wiktTranslationsResponse{}, fmt.Errorf("%w: build request: %v", ErrUnavailable, err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "ProjectPN-WiktAPI/1.0")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return wiktTranslationsResponse{}, fmt.Errorf("%w: call endpoint: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return wiktTranslationsResponse{}, fmt.Errorf("%w: read response: %v", ErrUnavailable, err)
	}
	if resp.StatusCode == http.StatusNotFound {
		return wiktTranslationsResponse{}, fmt.Errorf("%w: no entries for %q", ErrUnavailable, lemma)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return wiktTranslationsResponse{}, fmt.Errorf("%w: endpoint status %d: %s", ErrUnavailable, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed wiktTranslationsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return wiktTranslationsResponse{}, fmt.Errorf("%w: decode response: %v", ErrUnavailable, err)
	}
	return parsed, nil
}

func matchesDisplayLang(langCode, code, lang, want string) bool {
	want = strings.ToLower(strings.TrimSpace(want))
	if want == "" {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(langCode), want) || strings.EqualFold(strings.TrimSpace(code), want) {
		return true
	}
	lang = strings.ToLower(strings.TrimSpace(lang))
	switch want {
	case "ko":
		return lang == "korean" || lang == "한국어"
	case "ja":
		return lang == "japanese" || lang == "日本語"
	case "zh":
		return strings.Contains(lang, "chinese") || lang == "中文"
	default:
		return false
	}
}

func normalizePOS(pos string) string {
	pos = strings.ToLower(strings.TrimSpace(pos))
	switch pos {
	case "noun", "verb", "adjective", "adverb", "pronoun", "preposition",
		"conjunction", "interjection", "determiner", "particle", "numeral",
		"phrase", "proverb", "symbol", "affix", "infix", "prefix", "suffix",
		"circumfix", "clitic", "article", "classifier", "contraction":
		return pos
	case "adj":
		return "adjective"
	case "adv":
		return "adverb"
	case "conj":
		return "conjunction"
	case "prep":
		return "preposition"
	case "pron":
		return "pronoun"
	case "det":
		return "determiner"
	case "intj", "interj":
		return "interjection"
	default:
		if pos == "" {
			return ""
		}
		// Persist unknown POS values lowercased (schema allows free text).
		return pos
	}
}

func cleanGloss(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, ".,;:!")
	s = strings.Join(strings.Fields(s), " ")
	return s
}

func normalizeGlossKey(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.Is(unicode.Hangul, r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
