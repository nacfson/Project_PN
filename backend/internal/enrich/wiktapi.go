package enrich

import (
	"context"
	"encoding/json"
	"errors"
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

var errWiktNotFound = fmt.Errorf("%w: not found", ErrUnavailable)

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

type wiktDefinitionsResponse struct {
	Word        string `json:"word"`
	Edition     string `json:"edition"`
	Definitions []struct {
		POS      string `json:"pos"`
		LangCode string `json:"lang_code"`
		Senses   []struct {
			Glosses []string `json:"glosses"`
			Tags    []string `json:"tags"`
		} `json:"senses"`
	} `json:"definitions"`
}

type wiktGlossRow struct {
	pos   string
	sense string
	gloss string
}

// Enrich fetches KO (or other display-language) glosses for the lemma and maps
// each unique gloss to one sense. Examples are not generated.
func (w *WiktAPI) Enrich(ctx context.Context, req Request) (Result, error) {
	lemma := strings.TrimSpace(req.Text)
	if lemma == "" {
		return Result{}, fmt.Errorf("%w: empty word", ErrUnavailable)
	}
	targetLang := strings.ToLower(strings.TrimSpace(req.LanguageCode))
	if targetLang == "" {
		targetLang = "en"
	}
	displayLang := strings.ToLower(strings.TrimSpace(req.DefinitionLanguageCode))
	if displayLang == "" {
		displayLang = "ko"
	}

	existing := map[string]struct{}{}
	for _, e := range req.Existing {
		existing[normalizeGlossKey(e)] = struct{}{}
	}

	posFilter := strings.ToLower(strings.TrimSpace(req.POS))
	if posFilter == "any" {
		posFilter = ""
	}

	rows, sawDisplayGloss, err := w.collectGlossRows(ctx, lemma, targetLang, displayLang, posFilter, existing)
	if err != nil {
		return Result{}, err
	}

	if len(rows) == 0 {
		if len(existing) > 0 || posFilter != "" || sawDisplayGloss {
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
				Lemma:        lemma,
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
	targetLang := strings.ToLower(strings.TrimSpace(req.LanguageCode))
	if targetLang == "" {
		targetLang = "en"
	}

	rows, _, err := w.collectGlossRows(ctx, lemma, targetLang, displayLang, "", nil)
	if err != nil {
		return TranslateResult{}, err
	}
	if len(rows) == 0 {
		return TranslateResult{}, fmt.Errorf("%w: no %s glosses for %q", ErrUnavailable, displayLang, lemma)
	}

	used := map[int]struct{}{}
	out := TranslateResult{Senses: make([]TranslateSenseResult, 0, len(req.Senses))}
	for _, sense := range req.Senses {
		gloss := ""
		defKey := normalizeGlossKey(sense.Definition)
		shortKey := normalizeGlossKey(sense.ShortDefinition)
		for i, p := range rows {
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
			for i, p := range rows {
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

func (w *WiktAPI) collectGlossRows(
	ctx context.Context,
	lemma, targetLang, displayLang, posFilter string,
	existing map[string]struct{},
) ([]wiktGlossRow, bool, error) {
	candidates := []string{lemma}
	if !IsMultiWordLemma(lemma) && targetLang == "en" {
		candidates = append(candidates, englishStemCandidates(lemma)...)
	}

	var (
		rows              []wiktGlossRow
		seenGloss         = map[string]struct{}{}
		anyEndpointFound  bool
		sawDisplayGloss   bool
		rootEnglishPOS    []string
		rootEnglishSenses []string
	)

	addRow := func(pos, sense, gloss string) {
		if gloss == "" {
			return
		}
		sawDisplayGloss = true
		key := pos + "\x00" + normalizeGlossKey(gloss)
		if _, ok := seenGloss[key]; ok {
			return
		}
		if existing != nil {
			if _, skip := existing[normalizeGlossKey(gloss)]; skip {
				return
			}
			if sense != "" {
				if _, skip := existing[normalizeGlossKey(sense)]; skip {
					return
				}
			}
		}
		seenGloss[key] = struct{}{}
		rows = append(rows, wiktGlossRow{pos: pos, sense: strings.TrimSpace(sense), gloss: gloss})
	}

	for idx, candidate := range candidates {
		isRoot := idx == 0
		var candidateEnglishPOS []string
		var candidateEnglishSenses []string

		rawTrans, transErr := w.fetchTranslations(ctx, candidate)
		if transErr != nil && !errors.Is(transErr, errWiktNotFound) {
			return nil, false, transErr
		}
		if transErr == nil {
			anyEndpointFound = true
			for _, block := range rawTrans.Translations {
				normPOS := normalizePOS(block.POS)
				if normPOS != "" && normPOS != "unknown" {
					candidateEnglishPOS = appendUniqueString(candidateEnglishPOS, normPOS)
					if isRoot {
						rootEnglishPOS = appendUniqueString(rootEnglishPOS, normPOS)
					}
				}
				for _, t := range block.Translations {
					if s := strings.TrimSpace(t.Sense); s != "" {
						candidateEnglishSenses = appendUniqueString(candidateEnglishSenses, s)
						if isRoot {
							rootEnglishSenses = appendUniqueString(rootEnglishSenses, s)
						}
					}
				}
			}

			for _, block := range rawTrans.Translations {
				pos := resolveCandidatePOS(block.POS, isRoot, rootEnglishPOS, candidateEnglishPOS, posFilter)
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
					addRow(pos, t.Sense, cleanGloss(t.Word))
				}
			}
		}

		if len(rows) > 0 || (isRoot && sawDisplayGloss) {
			break
		}

		rawDefs, defErr := w.fetchDefinitions(ctx, displayLang, candidate)
		if defErr != nil && !errors.Is(defErr, errWiktNotFound) {
			return nil, false, defErr
		}
		if defErr == nil {
			anyEndpointFound = true
			enSenses := rootEnglishSenses
			if len(enSenses) == 0 {
				enSenses = candidateEnglishSenses
			}
			senseIdx := 0
			for _, defBlock := range rawDefs.Definitions {
				if defBlock.LangCode != "" && !strings.EqualFold(defBlock.LangCode, targetLang) {
					continue
				}
				pos := resolveCandidatePOS(defBlock.POS, isRoot, rootEnglishPOS, candidateEnglishPOS, posFilter)
				if pos == "" {
					continue
				}
				if IsMultiWordLemma(lemma) {
					pos = "phrase"
				}
				if posFilter != "" && pos != posFilter {
					continue
				}
				for _, senseItem := range defBlock.Senses {
					for _, rawGloss := range senseItem.Glosses {
						for _, gloss := range extractDefinitionGlosses(rawGloss) {
							enSense := ""
							if senseIdx < len(enSenses) {
								enSense = enSenses[senseIdx]
								senseIdx++
							}
							addRow(pos, enSense, gloss)
						}
					}
				}
			}
		}

		if len(rows) > 0 || (isRoot && !anyEndpointFound) {
			break
		}
	}

	if !anyEndpointFound {
		return nil, false, fmt.Errorf("%w: no entries for %q", ErrUnavailable, lemma)
	}
	return rows, sawDisplayGloss, nil
}

func (w *WiktAPI) fetchTranslations(ctx context.Context, lemma string) (wiktTranslationsResponse, error) {
	endpoint := fmt.Sprintf("%s/v1/en/word/%s/translations", w.baseURL, url.PathEscape(lemma))
	var parsed wiktTranslationsResponse
	if err := w.getJSON(ctx, endpoint, lemma, &parsed); err != nil {
		return wiktTranslationsResponse{}, err
	}
	return parsed, nil
}

func (w *WiktAPI) fetchDefinitions(ctx context.Context, edition, lemma string) (wiktDefinitionsResponse, error) {
	endpoint := fmt.Sprintf("%s/v1/%s/word/%s/definitions", w.baseURL, url.PathEscape(edition), url.PathEscape(lemma))
	var parsed wiktDefinitionsResponse
	if err := w.getJSON(ctx, endpoint, lemma, &parsed); err != nil {
		return wiktDefinitionsResponse{}, err
	}
	return parsed, nil
}

func (w *WiktAPI) getJSON(ctx context.Context, endpoint, lemma string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("%w: build request: %v", ErrUnavailable, err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "ProjectPN-WiktAPI/1.0")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: call endpoint: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return fmt.Errorf("%w: read response: %v", ErrUnavailable, err)
	}
	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("%w: no entries for %q", errWiktNotFound, lemma)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%w: endpoint status %d: %s", ErrUnavailable, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return fmt.Errorf("%w: decode response: %v", ErrUnavailable, err)
	}
	return nil
}

func resolveCandidatePOS(rawPOS string, isRoot bool, rootEnglishPOS, candidateEnglishPOS []string, posFilter string) string {
	pos := normalizePOS(rawPOS)
	if !isRoot {
		if posFilter != "" && containsString(rootEnglishPOS, posFilter) {
			return posFilter
		}
		if len(rootEnglishPOS) > 0 {
			return rootEnglishPOS[0]
		}
	}
	if pos != "" && pos != "unknown" {
		return pos
	}
	if posFilter != "" && (len(rootEnglishPOS) == 0 || containsString(rootEnglishPOS, posFilter)) {
		return posFilter
	}
	if len(rootEnglishPOS) > 0 {
		return rootEnglishPOS[0]
	}
	if len(candidateEnglishPOS) > 0 {
		return candidateEnglishPOS[0]
	}
	if pos == "unknown" {
		return "noun"
	}
	return pos
}

func appendUniqueString(slice []string, val string) []string {
	for _, existing := range slice {
		if existing == val {
			return slice
		}
	}
	return append(slice, val)
}

func containsString(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

func stripDefinitionAnnotations(s string) string {
	var b strings.Builder
	depthParen := 0
	depthBracket := 0
	depthGuillemet := 0
	for _, r := range s {
		switch r {
		case '(', '（':
			depthParen++
			continue
		case ')', '）':
			if depthParen > 0 {
				depthParen--
			}
			continue
		case '[':
			depthBracket++
			continue
		case ']':
			if depthBracket > 0 {
				depthBracket--
			}
			continue
		case '«':
			depthGuillemet++
			continue
		case '»':
			if depthGuillemet > 0 {
				depthGuillemet--
			}
			continue
		}
		if depthParen == 0 && depthBracket == 0 && depthGuillemet == 0 {
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(b.String())
}

func extractDefinitionGlosses(raw string) []string {
	cleaned := stripDefinitionAnnotations(raw)
	if cleaned == "" {
		cleaned = strings.TrimSpace(raw)
	}
	parts := strings.FieldsFunc(cleaned, func(r rune) bool {
		return r == ',' || r == ';' || r == '，' || r == '；'
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		g := cleanGloss(part)
		if g != "" {
			out = append(out, g)
		}
	}
	return out
}

func englishStemCandidates(lemma string) []string {
	w := strings.ToLower(strings.TrimSpace(lemma))
	if len(w) < 4 || IsMultiWordLemma(w) {
		return nil
	}
	var out []string
	add := func(cand string) {
		if len(cand) < 3 || cand == w {
			return
		}
		out = appendUniqueString(out, cand)
	}

	if strings.HasSuffix(w, "ied") && len(w) > 4 {
		add(w[:len(w)-3] + "y")
	}
	if strings.HasSuffix(w, "ed") && len(w) > 4 {
		add(w[:len(w)-1])
		add(w[:len(w)-2])
		if len(w) > 5 && w[len(w)-3] == w[len(w)-4] {
			add(w[:len(w)-3])
		}
	}
	if strings.HasSuffix(w, "ing") && len(w) > 5 {
		base := w[:len(w)-3]
		add(base)
		add(base + "e")
		if len(base) > 2 && base[len(base)-1] == base[len(base)-2] {
			add(base[:len(base)-1])
		}
	}
	if strings.HasSuffix(w, "ily") && len(w) > 5 {
		add(w[:len(w)-3] + "y")
	}
	if strings.HasSuffix(w, "ly") && len(w) > 4 {
		add(w[:len(w)-2])
		add(w[:len(w)-2] + "e")
	}
	if strings.HasSuffix(w, "ies") && len(w) > 4 {
		add(w[:len(w)-3] + "y")
	}
	if strings.HasSuffix(w, "es") && len(w) > 4 {
		add(w[:len(w)-2])
		add(w[:len(w)-1])
	}
	if strings.HasSuffix(w, "s") && !strings.HasSuffix(w, "ss") && len(w) > 3 {
		add(w[:len(w)-1])
	}
	return out
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
