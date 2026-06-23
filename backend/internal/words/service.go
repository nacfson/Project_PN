package words

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/enrich"
)

// Sentinel errors mapped to HTTP statuses by the handler layer.
var (
	ErrSenseNotFound            = errors.New("words: word sense not found")
	ErrForceAmbiguous           = errors.New("words: forced generation needs a concrete part_of_speech or word_id")
	ErrNoSenses                 = errors.New("words: no senses available and generation is disabled")
	ErrInvalidCursor            = errors.New("words: invalid learning items cursor")
	ErrTranslationUnavailable   = errors.New("words: localized translation unavailable")
)

// querier is satisfied by both *pgxpool.Pool and pgx.Tx.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Service implements the add-word flow over the global cache tables.
type Service struct {
	pool     *pgxpool.Pool
	enricher enrich.Enricher

	DefaultUserID  string
	TargetLang     string
	DefinitionLang string
}

type learningItemsCursorPayload struct {
	AddedAt time.Time `json:"added_at"`
	ID      string    `json:"id"`
}

func New(pool *pgxpool.Pool, enricher enrich.Enricher, defaultUserID, targetLang, definitionLang string) *Service {
	return &Service{
		pool:           pool,
		enricher:       enricher,
		DefaultUserID:  defaultUserID,
		TargetLang:     targetLang,
		DefinitionLang: definitionLang,
	}
}

// Lookup returns sense options for a word. POS may be nil ("Any" -> all parts
// of speech) or a concrete value. On a full cache miss it enriches once and
// persists the result before returning.
func (s *Service) Lookup(ctx context.Context, text, langCode, defLangCode string, pos *string) (LookupResult, error) {
	langCode, defLangCode = s.fillLangs(langCode, defLangCode)
	normalized := normalize(text)
	if normalized == "" {
		return LookupResult{}, fmt.Errorf("words: empty lookup text")
	}

	wordIDs, err := s.findWordIDs(ctx, s.pool, langCode, normalized, pos)
	if err != nil {
		return LookupResult{}, err
	}

	if len(wordIDs) > 0 {
		if _, err := s.ensureTranslationsForWord(ctx, wordIDs, defLangCode); err != nil {
			return LookupResult{}, err
		}
		options, err := loadSenseOptions(ctx, s.pool, wordIDs, defLangCode)
		if err != nil {
			return LookupResult{}, err
		}
		return LookupResult{Query: text, NormalizedText: normalized, SenseOptions: options}, nil
	}

	posHint := ""
	if pos != nil {
		posHint = *pos
	}
	result, err := s.enricher.Enrich(ctx, enrich.Request{
		Text:                   normalized,
		LanguageCode:           langCode,
		DefinitionLanguageCode: defLangCode,
		POS:                    posHint,
	})
	if err != nil {
		return LookupResult{}, err
	}

	options, err := s.persistEntries(ctx, langCode, defLangCode, normalized, result.Entries)
	if err != nil {
		return LookupResult{}, err
	}
	return LookupResult{Query: text, NormalizedText: normalized, SenseOptions: options}, nil
}

// ForceGenerate is the "none of these match" path. It appends a new sense and
// returns the refreshed options for the affected word(s).
func (s *Service) ForceGenerate(ctx context.Context, wordID *string, text, langCode, defLangCode string, pos *string) (LookupResult, error) {
	langCode, defLangCode = s.fillLangs(langCode, defLangCode)
	normalized := normalize(text)

	if wordID == nil && (pos == nil || normalize(*pos) == "" || strings.EqualFold(*pos, "any")) {
		return LookupResult{}, ErrForceAmbiguous
	}

	if wordID != nil {
		return s.forceUnderWord(ctx, *wordID, defLangCode)
	}

	posValue := strings.ToLower(strings.TrimSpace(*pos))
	if normalized == "" {
		return LookupResult{}, fmt.Errorf("words: empty lookup text")
	}
	existing, _ := s.existingDefinitionsByIdentity(ctx, langCode, normalized, posValue)
	result, err := s.enricher.Enrich(ctx, enrich.Request{
		Text:                   normalized,
		LanguageCode:           langCode,
		DefinitionLanguageCode: defLangCode,
		POS:                    posValue,
		Existing:               existing,
	})
	if err != nil {
		return LookupResult{}, err
	}
	options, err := s.persistEntries(ctx, langCode, defLangCode, normalized, result.Entries)
	if err != nil {
		return LookupResult{}, err
	}
	return LookupResult{Query: text, NormalizedText: normalized, SenseOptions: options}, nil
}

func (s *Service) forceUnderWord(ctx context.Context, wordID, defLangCode string) (LookupResult, error) {
	var langCode, lemma, normalized, pos string
	err := s.pool.QueryRow(ctx,
		`select language_code, lemma, normalized_text, part_of_speech from words where id = $1::uuid`,
		wordID,
	).Scan(&langCode, &lemma, &normalized, &pos)
	if errors.Is(err, pgx.ErrNoRows) {
		return LookupResult{}, ErrSenseNotFound
	}
	if err != nil {
		return LookupResult{}, fmt.Errorf("words: load word: %w", err)
	}

	existing, err := s.existingDefinitions(ctx, wordID)
	if err != nil {
		return LookupResult{}, err
	}

	result, err := s.enricher.Enrich(ctx, enrich.Request{
		Text:                   normalized,
		LanguageCode:           langCode,
		DefinitionLanguageCode: defLangCode,
		POS:                    pos,
		Existing:               existing,
	})
	if err != nil {
		return LookupResult{}, err
	}

	var newSenses []enrich.Sense
	for _, e := range result.Entries {
		if strings.EqualFold(e.PartOfSpeech, pos) {
			newSenses = append(newSenses, e.Senses...)
		}
	}
	if len(newSenses) == 0 {
		for _, e := range result.Entries {
			newSenses = append(newSenses, e.Senses...)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LookupResult{}, err
	}
	defer tx.Rollback(ctx)

	if err := appendSenses(ctx, tx, wordID, defLangCode, newSenses); err != nil {
		return LookupResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LookupResult{}, err
	}

	if _, err := s.ensureTranslationsForWord(ctx, []string{wordID}, defLangCode); err != nil {
		return LookupResult{}, err
	}
	options, err := loadSenseOptions(ctx, s.pool, []string{wordID}, defLangCode)
	if err != nil {
		return LookupResult{}, err
	}
	return LookupResult{Query: normalized, NormalizedText: normalized, SenseOptions: options}, nil
}

// AddLearningItem creates the personal user_word_senses + review_states rows
// for the given concrete word sense (idempotent).
func (s *Service) AddLearningItem(ctx context.Context, userID, wordSenseID, displayLangCode string) (LearningItem, error) {
	wordSenseID = strings.TrimSpace(wordSenseID)
	if wordSenseID == "" {
		return LearningItem{}, ErrSenseNotFound
	}

	var wordID, wordLang string
	err := s.pool.QueryRow(ctx, `
		select w.id::text, w.language_code
		from word_senses ws
		join words w on w.id = ws.word_id
		where ws.id = $1::uuid`,
		wordSenseID,
	).Scan(&wordID, &wordLang)
	if errors.Is(err, pgx.ErrNoRows) {
		return LearningItem{}, ErrSenseNotFound
	}
	if err != nil {
		return LearningItem{}, fmt.Errorf("words: verify sense: %w", err)
	}

	displayLang, err := s.resolveDisplayLang(ctx, userID, displayLangCode)
	if err != nil {
		return LearningItem{}, err
	}

	if displayLang != wordLang {
		if _, err := s.ensureTranslationsForWord(ctx, []string{wordID}, displayLang); err != nil {
			return LearningItem{}, err
		}
		var hasTranslation bool
		if err := s.pool.QueryRow(ctx, `
			select exists(
				select 1 from sense_translations
				where word_sense_id = $1::uuid and language_code = $2
			)`, wordSenseID, displayLang,
		).Scan(&hasTranslation); err != nil {
			return LearningItem{}, fmt.Errorf("words: verify translation: %w", err)
		}
		if !hasTranslation {
			var normalized string
			_ = s.pool.QueryRow(ctx, `select normalized_text from words where id = $1::uuid`, wordID).Scan(&normalized)
			slog.Warn("add refused: translation unavailable",
				"word", normalized, "target_lang", wordLang, "display_lang", displayLang,
				"reason", "language_mismatch")
			return LearningItem{}, ErrTranslationUnavailable
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LearningItem{}, err
	}
	defer tx.Rollback(ctx)

	var item LearningItem
	err = tx.QueryRow(ctx,
		`insert into user_word_senses (user_id, word_sense_id)
		 values ($1::uuid, $2::uuid)
		 on conflict (user_id, word_sense_id) do update set updated_at = now()
		 returning id::text, word_sense_id::text, learning_stage`,
		userID, wordSenseID,
	).Scan(&item.ID, &item.WordSenseID, &item.LearningStage)
	if err != nil {
		return LearningItem{}, fmt.Errorf("words: upsert user_word_sense: %w", err)
	}

	err = tx.QueryRow(ctx,
		`insert into review_states (user_word_sense_id)
		 values ($1::uuid)
		 on conflict (user_word_sense_id) do update set updated_at = now()
		 returning due_at`,
		item.ID,
	).Scan(&item.DueAt)
	if err != nil {
		return LearningItem{}, fmt.Errorf("words: ensure review_state: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return LearningItem{}, err
	}
	return item, nil
}

// ListLearningItems returns active personal learning items with keyset pagination.
func (s *Service) ListLearningItems(ctx context.Context, userID string, params ListLearningItemsParams) (LearningItemsPage, error) {
	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	queryLimit := limit + 1

	args := []any{userID, queryLimit}
	searchPredicate := ""
	if search := normalize(params.Search); search != "" {
		args = append(args, search+"%")
		searchPredicate = fmt.Sprintf("and w.normalized_text like $%d", len(args))
	}

	cursorPredicate := ""
	if params.Cursor != nil {
		args = append(args, params.Cursor.AddedAt, params.Cursor.ID)
		addedAtPlaceholder := len(args) - 1
		idPlaceholder := len(args)
		if params.Descending {
			cursorPredicate = fmt.Sprintf("and (uws.added_at, uws.id) < ($%d::timestamptz, $%d::uuid)", addedAtPlaceholder, idPlaceholder)
		} else {
			cursorPredicate = fmt.Sprintf("and (uws.added_at, uws.id) > ($%d::timestamptz, $%d::uuid)", addedAtPlaceholder, idPlaceholder)
		}
	}

	orderDirection := "asc"
	if params.Descending {
		orderDirection = "desc"
	}

	query := fmt.Sprintf(
		`select uws.id::text, uws.word_sense_id::text, w.id::text,
		        w.language_code, w.lemma, w.normalized_text, w.part_of_speech,
		        u.native_language,
		        ws.definition, ws.short_definition,
		        coalesce(st.definition, ws.definition),
		        coalesce(st.short_definition, ws.short_definition),
		        ws.cefr_level, ws.meaning_order,
		        uws.learning_stage, rs.due_at, uws.added_at
		 from user_word_senses uws
		 join users u on u.id = uws.user_id
		 join word_senses ws on ws.id = uws.word_sense_id
		 join words w on w.id = ws.word_id
		 join review_states rs on rs.user_word_sense_id = uws.id
		 left join sense_translations st
		   on st.word_sense_id = ws.id and st.language_code = u.native_language
		 where uws.user_id = $1::uuid
		   and uws.archived_at is null
		   %s
		   %s
		 order by uws.added_at %s, uws.id %s
		 limit $2`,
		searchPredicate, cursorPredicate, orderDirection, orderDirection,
	)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return LearningItemsPage{}, fmt.Errorf("words: list learning items: %w", err)
	}
	defer rows.Close()

	var items []LearningItemListItem
	for rows.Next() {
		var item LearningItemListItem
		if err := rows.Scan(
			&item.ID, &item.WordSenseID, &item.WordID,
			&item.LanguageCode, &item.Lemma, &item.NormalizedText, &item.PartOfSpeech,
			&item.DisplayLanguageCode,
			&item.Definition, &item.ShortDefinition,
			&item.LocalizedDefinition, &item.LocalizedShortDefinition,
			&item.CEFRLevel, &item.MeaningOrder,
			&item.LearningStage, &item.DueAt, &item.AddedAt,
		); err != nil {
			return LearningItemsPage{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return LearningItemsPage{}, err
	}

	var nextCursor *string
	if len(items) > limit {
		last := items[limit-1]
		cursor := encodeLearningItemsCursor(LearningItemsCursor{AddedAt: last.AddedAt, ID: last.ID})
		nextCursor = &cursor
		items = items[:limit]
	}

	// Load example sentences for each list item.
	for i := range items {
		examples, err := loadExamples(ctx, s.pool, items[i].WordSenseID, items[i].DisplayLanguageCode)
		if err != nil {
			return LearningItemsPage{}, err
		}
		items[i].Examples = examples
	}


	if items == nil {
		items = []LearningItemListItem{}
	}
	return LearningItemsPage{Items: items, NextCursor: nextCursor}, nil
}

func DecodeLearningItemsCursor(value string) (LearningItemsCursor, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return LearningItemsCursor{}, ErrInvalidCursor
	}

	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return LearningItemsCursor{}, ErrInvalidCursor
	}

	var payload learningItemsCursorPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return LearningItemsCursor{}, ErrInvalidCursor
	}
	if payload.AddedAt.IsZero() || strings.TrimSpace(payload.ID) == "" {
		return LearningItemsCursor{}, ErrInvalidCursor
	}
	return LearningItemsCursor{AddedAt: payload.AddedAt, ID: payload.ID}, nil
}

func encodeLearningItemsCursor(cursor LearningItemsCursor) string {
	payload := learningItemsCursorPayload{AddedAt: cursor.AddedAt, ID: cursor.ID}
	raw, _ := json.Marshal(payload)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func (s *Service) fillLangs(langCode, defLangCode string) (string, string) {
	if strings.TrimSpace(langCode) == "" {
		langCode = s.TargetLang
	}
	if strings.TrimSpace(defLangCode) == "" {
		defLangCode = s.DefinitionLang
	}
	return langCode, defLangCode
}

func (s *Service) resolveDisplayLang(ctx context.Context, userID, displayLangCode string) (string, error) {
	if lang := strings.TrimSpace(displayLangCode); lang != "" {
		return lang, nil
	}
	if strings.TrimSpace(userID) != "" {
		var native string
		err := s.pool.QueryRow(ctx,
			`select native_language from users where id = $1::uuid`, userID,
		).Scan(&native)
		if err == nil && strings.TrimSpace(native) != "" {
			return native, nil
		}
	}
	return s.DefinitionLang, nil
}

func (s *Service) findWordIDs(ctx context.Context, q querier, langCode, normalized string, pos *string) ([]string, error) {
	var rows pgx.Rows
	var err error
	if pos != nil {
		rows, err = q.Query(ctx,
			`select id::text from words where language_code = $1 and normalized_text = $2 and part_of_speech = $3`,
			langCode, normalized, strings.ToLower(strings.TrimSpace(*pos)),
		)
	} else {
		rows, err = q.Query(ctx,
			`select id::text from words where language_code = $1 and normalized_text = $2`,
			langCode, normalized,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("words: find words: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Service) existingDefinitions(ctx context.Context, wordID string) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`select definition from word_senses where word_id = $1::uuid order by meaning_order`, wordID)
	if err != nil {
		return nil, fmt.Errorf("words: existing definitions: %w", err)
	}
	defer rows.Close()
	var defs []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		defs = append(defs, d)
	}
	return defs, rows.Err()
}

func (s *Service) existingDefinitionsByIdentity(ctx context.Context, langCode, normalized, pos string) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`select ws.definition
		 from word_senses ws
		 join words w on w.id = ws.word_id
		 where w.language_code = $1 and w.normalized_text = $2 and w.part_of_speech = $3
		 order by ws.meaning_order`,
		langCode, normalized, pos)
	if err != nil {
		return nil, fmt.Errorf("words: existing definitions: %w", err)
	}
	defer rows.Close()
	var defs []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		defs = append(defs, d)
	}
	return defs, rows.Err()
}

// ensureTranslationsForWord makes sure every sense/example under wordIDs has a
// valid translation row for displayLang, generating + caching the missing ones.
// Returns whether a complete, valid translation set now exists.
func (s *Service) ensureTranslationsForWord(ctx context.Context, wordIDs []string, displayLang string) (bool, error) {
	if len(wordIDs) == 0 {
		return true, nil
	}

	needsTranslation := false
	for _, wordID := range wordIDs {
		var wordLang string
		if err := s.pool.QueryRow(ctx,
			`select language_code from words where id = $1::uuid`, wordID,
		).Scan(&wordLang); err != nil {
			return false, fmt.Errorf("words: load word language: %w", err)
		}
		if displayLang != wordLang {
			needsTranslation = true
			break
		}
	}
	if !needsTranslation {
		return true, nil
	}

	complete := true
	for _, wordID := range wordIDs {
		ok, err := s.ensureWordTranslations(ctx, wordID, displayLang)
		if err != nil {
			return false, err
		}
		if !ok {
			complete = false
		}
	}
	return complete, nil
}

func (s *Service) ensureWordTranslations(ctx context.Context, wordID, displayLang string) (bool, error) {
	var wordLang, normalized string
	if err := s.pool.QueryRow(ctx,
		`select language_code, normalized_text from words where id = $1::uuid`, wordID,
	).Scan(&wordLang, &normalized); err != nil {
		return false, fmt.Errorf("words: load word: %w", err)
	}
	if displayLang == wordLang {
		return true, nil
	}

	missing, err := s.missingTranslationSenses(ctx, wordID, displayLang)
	if err != nil {
		return false, err
	}
	if len(missing) == 0 {
		return true, nil
	}

	if s.enricher == nil {
		return false, nil
	}

	input, err := s.buildTranslateInput(ctx, wordID, displayLang, missing)
	if err != nil {
		return false, err
	}
	if len(input.Senses) == 0 {
		return true, nil
	}

	result, err := s.enricher.Translate(ctx, input)
	if err != nil {
		slog.Warn("translation failed",
			"word", normalized, "target_lang", wordLang, "display_lang", displayLang,
			"reason", "translate_error", "error", err)
		return false, nil
	}

	if err := s.cacheTranslateResult(ctx, displayLang, result); err != nil {
		return false, err
	}

	stillMissing, err := s.missingTranslationSenses(ctx, wordID, displayLang)
	if err != nil {
		return false, err
	}
	return len(stillMissing) == 0, nil
}

func (s *Service) missingTranslationSenses(ctx context.Context, wordID, displayLang string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select ws.id::text
		from word_senses ws
		left join sense_translations st
		  on st.word_sense_id = ws.id and st.language_code = $2
		where ws.word_id = $1::uuid and st.id is null
		order by ws.meaning_order`,
		wordID, displayLang,
	)
	if err != nil {
		return nil, fmt.Errorf("words: find missing sense translations: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Service) buildTranslateInput(ctx context.Context, wordID, displayLang string, senseIDs []string) (enrich.TranslateRequest, error) {
	var wordText, wordLang string
	if err := s.pool.QueryRow(ctx,
		`select lemma, language_code from words where id = $1::uuid`, wordID,
	).Scan(&wordText, &wordLang); err != nil {
		return enrich.TranslateRequest{}, fmt.Errorf("words: load word for translate: %w", err)
	}

	req := enrich.TranslateRequest{
		WordText:     wordText,
		LanguageCode: wordLang,
		DisplayLang:  displayLang,
	}

	for _, senseID := range senseIDs {
		var definition string
		var shortDef *string
		if err := s.pool.QueryRow(ctx, `
			select definition, short_definition
			from word_senses where id = $1::uuid`, senseID,
		).Scan(&definition, &shortDef); err != nil {
			return enrich.TranslateRequest{}, fmt.Errorf("words: load sense for translate: %w", err)
		}

		senseInput := enrich.TranslateSenseInput{
			SenseID:         senseID,
			Definition:      definition,
			ShortDefinition: derefString(shortDef),
		}

		exampleRows, err := s.pool.Query(ctx, `
			select id::text, sentence from examples
			where word_sense_id = $1::uuid order by created_at`, senseID)
		if err != nil {
			return enrich.TranslateRequest{}, fmt.Errorf("words: load examples for translate: %w", err)
		}
		for exampleRows.Next() {
			var exampleID, sentence string
			if err := exampleRows.Scan(&exampleID, &sentence); err != nil {
				exampleRows.Close()
				return enrich.TranslateRequest{}, err
			}
			senseInput.Examples = append(senseInput.Examples, enrich.TranslateExampleInput{
				ExampleID: exampleID,
				Sentence:  sentence,
			})
		}
		exampleRows.Close()
		if err := exampleRows.Err(); err != nil {
			return enrich.TranslateRequest{}, err
		}

		req.Senses = append(req.Senses, senseInput)
	}
	return req, nil
}

func (s *Service) cacheTranslateResult(ctx context.Context, displayLang string, result enrich.TranslateResult) error {
	for _, sense := range result.Senses {
		if strings.TrimSpace(sense.Definition) == "" {
			continue
		}
		if _, err := s.pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition, short_definition)
			values ($1::uuid, $2, $3, $4)
			on conflict (word_sense_id, language_code) do nothing`,
			sense.SenseID, displayLang, sense.Definition, nullString(sense.ShortDefinition),
		); err != nil {
			return fmt.Errorf("words: cache sense translation: %w", err)
		}
		for _, ex := range sense.Examples {
			if strings.TrimSpace(ex.Translation) == "" {
				continue
			}
			if _, err := s.pool.Exec(ctx, `
				insert into example_translations (example_id, language_code, translation)
				values ($1::uuid, $2, $3)
				on conflict (example_id, language_code) do nothing`,
				ex.ExampleID, displayLang, ex.Translation,
			); err != nil {
				return fmt.Errorf("words: cache example translation: %w", err)
			}
		}
	}
	return nil
}

// persistEntries inserts enrich entries (words + senses + examples) and returns
// the resulting sense options.
func (s *Service) persistEntries(ctx context.Context, langCode, defLangCode, normalized string, entries []enrich.Entry) ([]SenseOption, error) {
	if len(entries) == 0 {
		return nil, ErrNoSenses
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	seen := map[string]bool{}
	var wordIDs []string
	for _, entry := range entries {
		pos := strings.ToLower(strings.TrimSpace(entry.PartOfSpeech))
		if pos == "" || len(entry.Senses) == 0 {
			continue
		}

		var wordID string
		err := tx.QueryRow(ctx,
			`insert into words (language_code, lemma, normalized_text, part_of_speech)
			 values ($1, $2, $3, $4)
			 on conflict (language_code, normalized_text, part_of_speech)
			 do update set updated_at = now()
			 returning id::text`,
			langCode, firstNonEmpty(entry.Lemma, normalized), normalized, pos,
		).Scan(&wordID)
		if err != nil {
			return nil, fmt.Errorf("words: upsert word: %w", err)
		}

		if err := appendSenses(ctx, tx, wordID, defLangCode, entry.Senses); err != nil {
			return nil, err
		}
		if !seen[wordID] {
			seen[wordID] = true
			wordIDs = append(wordIDs, wordID)
		}
	}

	if len(wordIDs) == 0 {
		return nil, ErrNoSenses
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	options, err := loadSenseOptions(ctx, s.pool, wordIDs, defLangCode)
	if err != nil {
		return nil, err
	}
	return options, nil
}

// appendSenses inserts senses (continuing meaning_order) plus their examples.
func appendSenses(ctx context.Context, tx pgx.Tx, wordID, defLangCode string, senses []enrich.Sense) error {
	var maxOrder int
	if err := tx.QueryRow(ctx,
		`select coalesce(max(meaning_order), 0) from word_senses where word_id = $1::uuid`,
		wordID,
	).Scan(&maxOrder); err != nil {
		return fmt.Errorf("words: max meaning_order: %w", err)
	}

	for _, sense := range senses {
		if strings.TrimSpace(sense.Definition) == "" {
			continue
		}
		maxOrder++
		var senseID string
		err := tx.QueryRow(ctx,
			`insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
			 values ($1::uuid, $2, $3, $4, $5)
			 returning id::text`,
			wordID, sense.Definition,
			nullString(sense.ShortDefinition), nullString(sense.CEFRLevel), maxOrder,
		).Scan(&senseID)
		if err != nil {
			return fmt.Errorf("words: insert sense: %w", err)
		}

		if strings.TrimSpace(sense.NativeDefinition) != "" {
			if _, err := tx.Exec(ctx, `
				insert into sense_translations (word_sense_id, language_code, definition, short_definition)
				values ($1::uuid, $2, $3, $4)
				on conflict (word_sense_id, language_code) do nothing`,
				senseID, defLangCode, sense.NativeDefinition, nullString(sense.NativeShortDefinition),
			); err != nil {
				return fmt.Errorf("words: insert sense translation: %w", err)
			}
		}

		for _, ex := range sense.Examples {
			if strings.TrimSpace(ex.Sentence) == "" {
				continue
			}
			var exampleID string
			if err := tx.QueryRow(ctx, `
				insert into examples (word_sense_id, sentence, difficulty_level, source)
				values ($1::uuid, $2, $3, 'enricher')
				returning id::text`,
				senseID, ex.Sentence, nullString(ex.Difficulty),
			).Scan(&exampleID); err != nil {
				return fmt.Errorf("words: insert example: %w", err)
			}
			if strings.TrimSpace(ex.Translation) != "" {
				if _, err := tx.Exec(ctx, `
					insert into example_translations (example_id, language_code, translation)
					values ($1::uuid, $2, $3)
					on conflict (example_id, language_code) do nothing`,
					exampleID, defLangCode, ex.Translation,
				); err != nil {
					return fmt.Errorf("words: insert example translation: %w", err)
				}
			}
		}
	}
	return nil
}

func loadSenseOptions(ctx context.Context, q querier, wordIDs []string, displayLang string) ([]SenseOption, error) {
	rows, err := q.Query(ctx,
		`select w.id::text, ws.id::text, w.language_code, w.lemma, w.normalized_text, w.part_of_speech,
		        ws.definition, ws.short_definition, ws.cefr_level, ws.meaning_order,
		        st.definition, st.short_definition
		 from words w
		 join word_senses ws on ws.word_id = w.id
		 left join sense_translations st
		   on st.word_sense_id = ws.id and st.language_code = $2
		 where w.id = any($1::uuid[])
		 order by w.part_of_speech, ws.meaning_order`,
		wordIDs, displayLang,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load senses: %w", err)
	}
	defer rows.Close()

	var options []SenseOption
	for rows.Next() {
		var o SenseOption
		var translatedDef, translatedShort *string
		if err := rows.Scan(
			&o.WordID, &o.WordSenseID, &o.LanguageCode, &o.Lemma, &o.NormalizedText, &o.PartOfSpeech,
			&o.Definition, &o.ShortDefinition, &o.CEFRLevel, &o.MeaningOrder,
			&translatedDef, &translatedShort,
		); err != nil {
			return nil, err
		}
		o.DisplayLanguageCode = displayLang
		o.LocalizedDefinition = o.Definition
		if translatedDef != nil && strings.TrimSpace(*translatedDef) != "" {
			o.LocalizedDefinition = *translatedDef
		}
		o.LocalizedShortDefinition = o.ShortDefinition
		if translatedShort != nil && strings.TrimSpace(*translatedShort) != "" {
			o.LocalizedShortDefinition = translatedShort
		}
		options = append(options, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range options {
		examples, err := loadExamples(ctx, q, options[i].WordSenseID, displayLang)
		if err != nil {
			return nil, err
		}
		options[i].Examples = examples
	}
	return options, nil
}

func loadExamples(ctx context.Context, q querier, wordSenseID, displayLang string) ([]Example, error) {
	rows, err := q.Query(ctx, `
		select e.sentence, e.difficulty_level, et.translation
		from examples e
		left join example_translations et
		  on et.example_id = e.id and et.language_code = $2
		where e.word_sense_id = $1::uuid
		order by e.created_at`,
		wordSenseID, displayLang,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load examples: %w", err)
	}
	defer rows.Close()
	var examples []Example
	for rows.Next() {
		var ex Example
		var localized *string
		if err := rows.Scan(&ex.Sentence, &ex.Difficulty, &localized); err != nil {
			return nil, err
		}
		if localized != nil && strings.TrimSpace(*localized) != "" {
			ex.LocalizedTranslation = localized
		} else {
			ex.LocalizedTranslation = &ex.Sentence
		}
		examples = append(examples, ex)
	}
	return examples, rows.Err()
}

func normalize(text string) string {
	return strings.ToLower(strings.Join(strings.Fields(text), " "))
}

func nullString(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// TODO: negative-cache / backoff for repeatedly-failing (word, language) pairs

// GetDueReviewItems returns due review items, respecting daily limits and
// excluding buried/suspended cards. Reviews (Review/Relearning state) are
// returned first, then new cards, up to their respective daily quotas.
func (s *Service) GetDueReviewItems(ctx context.Context, userID string, limit int) ([]DueItem, error) {
	if limit <= 0 {
		limit = 50
	}

	// Load or create review settings for the user.
	settings, err := s.ensureReviewSettingsPool(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("words: load review settings: %w", err)
	}

	// Load today's daily counts.
	now := time.Now().UTC()
	today := now.Format("2006-01-02")
	var dailyNew, dailyReviews int
	err = s.pool.QueryRow(ctx, `
		select coalesce(new_cards_done, 0), coalesce(reviews_done, 0)
		from daily_review_counts
		where user_id = $1::uuid and review_date = $2::date`,
		userID, today,
	).Scan(&dailyNew, &dailyReviews)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("words: load daily counts: %w", err)
	}

	reviewQuota := settings.ReviewsPerDay - dailyReviews
	newQuota := settings.NewCardsPerDay - dailyNew
	if reviewQuota < 0 {
		reviewQuota = 0
	}
	if newQuota < 0 {
		newQuota = 0
	}

	// Reviews are fetched first up to the request limit; any unused slots go to new cards.
	reviewFetchLimit := reviewQuota
	if reviewFetchLimit > limit {
		reviewFetchLimit = limit
	}

	if reviewFetchLimit == 0 && newQuota == 0 {
		return []DueItem{}, nil
	}

	baseQuery := `
		select uws.id::text, uws.word_sense_id::text, w.id::text,
		       w.language_code, w.lemma, w.normalized_text, w.part_of_speech,
		       u.native_language,
		       ws.definition, ws.short_definition,
		       coalesce(st.definition, ws.definition),
		       coalesce(st.short_definition, ws.short_definition),
		       ws.cefr_level, ws.meaning_order,
		       uws.learning_stage, rs.due_at,
		       rs.interval_days, rs.ease_factor,
		       rs.review_count, rs.lapse_count,
		       rs.fsrs_state, rs.stability, rs.difficulty,
		       rs.scheduled_days, rs.remaining_steps,
		       rs.last_reviewed_at
		from user_word_senses uws
		join users u on u.id = uws.user_id
		join word_senses ws on ws.id = uws.word_sense_id
		join words w on w.id = ws.word_id
		join review_states rs on rs.user_word_sense_id = uws.id
		left join sense_translations st
		  on st.word_sense_id = ws.id and st.language_code = u.native_language
		where uws.user_id = $1::uuid
		  and uws.archived_at is null
		  and uws.learning_stage != 'archived'
		  and rs.due_at <= now()
		  and rs.is_suspended = false
		  and (rs.buried_until is null or rs.buried_until <= now())`

	cfg := SchedulerConfigFromSettings(settings)
	var items []DueItem

	scanDueItem := func(rows pgx.Rows, item *DueItem) error {
		var intervalDays int
		var easeFactor float64
		var reviewCount int
		var lapseCount int
		var fsrsState string
		var stability float64
		var difficulty float64
		var scheduledDays int
		var remainingSteps int
		var lastReviewedAt sql.NullTime

		err := rows.Scan(
			&item.UserWordSenseID, &item.WordSenseID, &item.WordID,
			&item.LanguageCode, &item.Lemma, &item.NormalizedText, &item.PartOfSpeech,
			&item.DisplayLanguageCode,
			&item.Definition, &item.ShortDefinition,
			&item.LocalizedDefinition, &item.LocalizedShortDefinition,
			&item.CEFRLevel, &item.MeaningOrder,
			&item.LearningStage, &item.DueAt,
			&intervalDays, &easeFactor,
			&reviewCount, &lapseCount,
			&fsrsState, &stability, &difficulty,
			&scheduledDays, &remainingSteps,
			&lastReviewedAt,
		)
		if err != nil {
			return err
		}

		var reviewedAt *time.Time
		if lastReviewedAt.Valid {
			reviewedAt = &lastReviewedAt.Time
		}

		if reviewCount > 0 && (stability <= 0 || difficulty <= 0) {
			stability, difficulty = MemoryStateFromSM2(easeFactor, intervalDays)
			if fsrsState == "New" {
				fsrsState = "Review"
			}
		}

		state := FSRSState{
			State:          fsrsState,
			Stability:      stability,
			Difficulty:     difficulty,
			ScheduledDays:  scheduledDays,
			ReviewCount:    reviewCount,
			LapseCount:     lapseCount,
			LastReviewedAt: reviewedAt,
			RemainingSteps: remainingSteps,
		}
		item.PreviewIntervals = ptr(PreviewIntervals(state, now, cfg))
		return nil
	}

	// Fetch review items (Review and Relearning states) first.
	if reviewFetchLimit > 0 {
		reviewQuery := baseQuery + `
		  and rs.fsrs_state in ('Review', 'Relearning')
		order by rs.due_at asc
		limit $2`

		rows, err := s.pool.Query(ctx, reviewQuery, userID, reviewFetchLimit)
		if err != nil {
			return nil, fmt.Errorf("words: get due review items: %w", err)
		}
		for rows.Next() {
			var item DueItem
			if err := scanDueItem(rows, &item); err != nil {
				rows.Close()
				return nil, err
			}
			items = append(items, item)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}

	reviewCount := len(items)

	// Fetch new cards (New state) in any remaining slots after due reviews.
	newFetchLimit := newQuota
	remainingLimit := limit - len(items)
	if newFetchLimit > remainingLimit {
		newFetchLimit = remainingLimit
	}

	if newFetchLimit > 0 {
		newQuery := baseQuery + `
		  and rs.fsrs_state = 'New'
		order by uws.added_at asc
		limit $2`

		rows, err := s.pool.Query(ctx, newQuery, userID, newFetchLimit)
		if err != nil {
			return nil, fmt.Errorf("words: get due new cards: %w", err)
		}
		for rows.Next() {
			var item DueItem
			if err := scanDueItem(rows, &item); err != nil {
				rows.Close()
				return nil, err
			}
			items = append(items, item)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}

	// Interleave within due reviews and new cards separately; keep reviews first.
	if reviewCount > 1 {
		items = append(interleaveDueItems(items[:reviewCount]), items[reviewCount:]...)
	}
	if len(items) > reviewCount+1 {
		items = append(items[:reviewCount], interleaveDueItems(items[reviewCount:])...)
	}

	// Load example sentences for each due item.
	for i := range items {
		examples, err := loadExamples(ctx, s.pool, items[i].WordSenseID, items[i].DisplayLanguageCode)
		if err != nil {
			return nil, err
		}
		items[i].Examples = examples
	}

	if items == nil {
		items = []DueItem{}
	}
	return items, nil
}

const (
	minDesiredRetention = 0.80
	maxDesiredRetention = 0.95
)

func clampDesiredRetention(value float64) float64 {
	return clamp(value, minDesiredRetention, maxDesiredRetention)
}

func ptr[T any](v T) *T {
	return &v
}

// GetReviewSettings returns the user's review scheduling settings, creating
// defaults when the row does not yet exist.
func (s *Service) GetReviewSettings(ctx context.Context, userID string) (ReviewSettings, error) {
	settings, err := s.ensureReviewSettingsPool(ctx, userID)
	if err != nil {
		return ReviewSettings{}, fmt.Errorf("words: get review settings: %w", err)
	}
	settings.UserID = userID
	return settings, nil
}

// UpdateReviewSettings updates review settings fields for the user.
func (s *Service) UpdateReviewSettings(ctx context.Context, userID string, params UpdateReviewSettingsParams) (ReviewSettings, error) {
	if params.DesiredRetention == nil && params.DailyGoalXP == nil {
		return s.GetReviewSettings(ctx, userID)
	}

	if _, err := s.ensureReviewSettingsPool(ctx, userID); err != nil {
		return ReviewSettings{}, fmt.Errorf("words: ensure review settings: %w", err)
	}

	if params.DesiredRetention != nil {
		clamped := clampDesiredRetention(*params.DesiredRetention)
		if _, err := s.pool.Exec(ctx, `
			update review_settings
			set desired_retention = $1, updated_at = now()
			where user_id = $2::uuid`,
			clamped, userID,
		); err != nil {
			return ReviewSettings{}, fmt.Errorf("words: update desired retention: %w", err)
		}
	}

	if params.DailyGoalXP != nil {
		clamped := clampDailyGoalXP(*params.DailyGoalXP)
		if _, err := s.pool.Exec(ctx, `
			update review_settings
			set daily_goal_xp = $1, updated_at = now()
			where user_id = $2::uuid`,
			clamped, userID,
		); err != nil {
			return ReviewSettings{}, fmt.Errorf("words: update daily goal: %w", err)
		}
	}

	return s.GetReviewSettings(ctx, userID)
}


// ensureReviewSettingsPool loads or creates the user's review_settings row
// using the connection pool (non-transactional).
func (s *Service) ensureReviewSettingsPool(ctx context.Context, userID string) (ReviewSettings, error) {
	settings := DefaultReviewSettings(userID)

	var weightsArr []float64
	var optimizedAt *time.Time
	var weightsReviewCount int

	err := s.pool.QueryRow(ctx, `
		insert into review_settings (user_id)
		values ($1::uuid)
		on conflict (user_id) do update set updated_at = now()
		returning new_cards_per_day, reviews_per_day, learning_steps, relearning_steps,
		          leech_threshold, leech_action, fuzz_enabled, desired_retention,
		          daily_goal_xp, fsrs_weights, weights_optimized_at, weights_review_count`,
		userID,
	).Scan(
		&settings.NewCardsPerDay,
		&settings.ReviewsPerDay,
		&settings.LearningSteps,
		&settings.RelearningSteps,
		&settings.LeechThreshold,
		&settings.LeechAction,
		&settings.FuzzEnabled,
		&settings.DesiredRetention,
		&settings.DailyGoalXP,
		&weightsArr,
		&optimizedAt,
		&weightsReviewCount,
	)
	if err != nil {
		return ReviewSettings{}, fmt.Errorf("ensure review settings: %w", err)
	}

	if len(weightsArr) == 19 {
		settings.FSRSWeights = weightsArr
	}
	settings.WeightsOptimizedAt = optimizedAt
	settings.WeightsReviewCount = weightsReviewCount

	return settings, nil
}

