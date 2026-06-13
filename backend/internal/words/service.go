package words

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/enrich"
)

// Sentinel errors mapped to HTTP statuses by the handler layer.
var (
	ErrSenseNotFound  = errors.New("words: word sense not found")
	ErrForceAmbiguous = errors.New("words: forced generation needs a concrete part_of_speech or word_id")
	ErrNoSenses       = errors.New("words: no senses available and generation is disabled")
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

	if len(wordIDs) > 0 { // cache hit: free
		options, err := loadSenseOptions(ctx, s.pool, wordIDs)
		if err != nil {
			return LookupResult{}, err
		}
		return LookupResult{Query: text, NormalizedText: normalized, SenseOptions: options}, nil
	}

	// Full miss: generate once and persist.
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

	// No word_id: a concrete POS is guaranteed by the guard above.
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

	// Collect senses from the entry that matches this word's POS.
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
	options, err := loadSenseOptions(ctx, tx, []string{wordID})
	if err != nil {
		return LookupResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LookupResult{}, err
	}
	return LookupResult{Query: normalized, NormalizedText: normalized, SenseOptions: options}, nil
}

// AddLearningItem creates the personal user_word_senses + review_states rows
// for the given concrete word sense (idempotent).
func (s *Service) AddLearningItem(ctx context.Context, userID, wordSenseID string) (LearningItem, error) {
	wordSenseID = strings.TrimSpace(wordSenseID)
	if wordSenseID == "" {
		return LearningItem{}, ErrSenseNotFound
	}

	var exists bool
	if err := s.pool.QueryRow(ctx,
		`select exists(select 1 from word_senses where id = $1::uuid)`, wordSenseID,
	).Scan(&exists); err != nil {
		return LearningItem{}, fmt.Errorf("words: verify sense: %w", err)
	}
	if !exists {
		return LearningItem{}, ErrSenseNotFound
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

func (s *Service) fillLangs(langCode, defLangCode string) (string, string) {
	if strings.TrimSpace(langCode) == "" {
		langCode = s.TargetLang
	}
	if strings.TrimSpace(defLangCode) == "" {
		defLangCode = s.DefinitionLang
	}
	return langCode, defLangCode
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

	options, err := loadSenseOptions(ctx, tx, wordIDs)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return options, nil
}

// appendSenses inserts senses (continuing meaning_order) plus their examples.
func appendSenses(ctx context.Context, tx pgx.Tx, wordID, defLangCode string, senses []enrich.Sense) error {
	var maxOrder int
	if err := tx.QueryRow(ctx,
		`select coalesce(max(meaning_order), 0) from word_senses where word_id = $1::uuid and definition_language_code = $2`,
		wordID, defLangCode,
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
			`insert into word_senses (word_id, definition_language_code, definition, short_definition, cefr_level, meaning_order)
			 values ($1::uuid, $2, $3, $4, $5, $6)
			 returning id::text`,
			wordID, defLangCode, sense.Definition,
			nullString(sense.ShortDefinition), nullString(sense.CEFRLevel), maxOrder,
		).Scan(&senseID)
		if err != nil {
			return fmt.Errorf("words: insert sense: %w", err)
		}

		for _, ex := range sense.Examples {
			if strings.TrimSpace(ex.Sentence) == "" {
				continue
			}
			if _, err := tx.Exec(ctx,
				`insert into examples (word_sense_id, sentence, translation, translation_language_code)
				 values ($1::uuid, $2, $3, $4)`,
				senseID, ex.Sentence, nullString(ex.Translation), defLangCode,
			); err != nil {
				return fmt.Errorf("words: insert example: %w", err)
			}
		}
	}
	return nil
}

func loadSenseOptions(ctx context.Context, q querier, wordIDs []string) ([]SenseOption, error) {
	rows, err := q.Query(ctx,
		`select w.id::text, ws.id::text, w.language_code, w.lemma, w.normalized_text, w.part_of_speech,
		        ws.definition_language_code, ws.definition, ws.short_definition, ws.cefr_level, ws.meaning_order
		 from words w
		 join word_senses ws on ws.word_id = w.id
		 where w.id = any($1::uuid[])
		 order by w.part_of_speech, ws.meaning_order`,
		wordIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load senses: %w", err)
	}
	defer rows.Close()

	var options []SenseOption
	for rows.Next() {
		var o SenseOption
		if err := rows.Scan(
			&o.WordID, &o.WordSenseID, &o.LanguageCode, &o.Lemma, &o.NormalizedText, &o.PartOfSpeech,
			&o.DefinitionLanguageCode, &o.Definition, &o.ShortDefinition, &o.CEFRLevel, &o.MeaningOrder,
		); err != nil {
			return nil, err
		}
		options = append(options, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range options {
		examples, err := loadExamples(ctx, q, options[i].WordSenseID)
		if err != nil {
			return nil, err
		}
		options[i].Examples = examples
	}
	return options, nil
}

func loadExamples(ctx context.Context, q querier, wordSenseID string) ([]Example, error) {
	rows, err := q.Query(ctx,
		`select sentence, translation from examples where word_sense_id = $1::uuid order by created_at`,
		wordSenseID,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load examples: %w", err)
	}
	defer rows.Close()
	var examples []Example
	for rows.Next() {
		var ex Example
		if err := rows.Scan(&ex.Sentence, &ex.Translation); err != nil {
			return nil, err
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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
