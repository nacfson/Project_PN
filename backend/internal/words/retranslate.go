package words

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"project-pn/internal/enrich"
)

// RemapPreview is one proposed old→new sense match for dry-run logging.
type RemapPreview struct {
	WordID        string
	Lemma         string
	PartOfSpeech  string
	OldSenseID    string
	OldDefinition string
	OldLocalized  string
	NewDefinition string
	NewLocalized  string
	UserCardCount int
}

// ListWordIDsForUser returns distinct word IDs for the user's active learning items.
func (s *Service) ListWordIDsForUser(ctx context.Context, userID string, limit int) ([]string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, fmt.Errorf("words: user id required")
	}

	q := `
		select distinct w.id::text
		from user_word_senses uws
		join word_senses ws on ws.id = uws.word_sense_id
		join words w on w.id = ws.word_id
		where uws.user_id = $1::uuid
		  and uws.archived_at is null
		order by w.id::text`
	var (
		rows pgx.Rows
		err  error
	)
	if limit > 0 {
		rows, err = s.pool.Query(ctx, q+` limit $2`, userID, limit)
	} else {
		rows, err = s.pool.Query(ctx, q, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("words: list user word ids: %w", err)
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

// ResolveUserIDByEmail returns the users.id for a normalized email.
func (s *Service) ResolveUserIDByEmail(ctx context.Context, email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", fmt.Errorf("words: email required")
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		select id::text from users where lower(email) = $1 limit 1`,
		email,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("words: no user with email %q", email)
		}
		return "", fmt.Errorf("words: resolve user email: %w", err)
	}
	return id, nil
}

// PreviewRetranslateWord calls the enricher and reports AutoMatch mapping without writing.
func (s *Service) PreviewRetranslateWord(ctx context.Context, wordID string) ([]RemapPreview, error) {
	var (
		langCode   string
		normalized string
		pos        string
		lemma      string
	)
	err := s.pool.QueryRow(ctx, `
		select language_code, normalized_text, part_of_speech, lemma
		from words where id = $1::uuid`,
		wordID,
	).Scan(&langCode, &normalized, &pos, &lemma)
	if err != nil {
		return nil, fmt.Errorf("words: load word for preview: %w", err)
	}

	defLang := strings.TrimSpace(s.DefinitionLang)
	if defLang == "" {
		defLang = "ko"
	}

	oldSenses, err := loadSenseMatchInputs(ctx, s.pool, wordID, defLang)
	if err != nil {
		return nil, err
	}
	if s.enricher == nil {
		return nil, fmt.Errorf("words: enricher not configured for retranslate")
	}
	result, err := s.enricher.Enrich(ctx, enrich.Request{
		Text:                   normalized,
		LanguageCode:           langCode,
		DefinitionLanguageCode: defLang,
		POS:                    pos,
	})
	if err != nil {
		return nil, fmt.Errorf("words: retranslate enrich preview: %w", err)
	}

	var newSenses []enrich.Sense
	for _, entry := range result.Entries {
		if pos != "" && !strings.EqualFold(strings.TrimSpace(entry.PartOfSpeech), pos) {
			continue
		}
		newSenses = append(newSenses, entry.Senses...)
	}
	if len(newSenses) == 0 {
		for _, entry := range result.Entries {
			newSenses = append(newSenses, entry.Senses...)
		}
	}
	if len(newSenses) == 0 {
		return nil, fmt.Errorf("words: retranslate produced no senses for word %s", wordID)
	}

	candidates := make([]SenseMatchInput, 0, len(newSenses))
	for i, sense := range newSenses {
		candidates = append(candidates, SenseMatchInput{
			ID:                  fmt.Sprintf("preview-%d", i),
			Definition:          sense.Definition,
			LocalizedDefinition: firstNonEmpty(sense.NativeShortDefinition, sense.NativeDefinition),
			MeaningOrder:        i + 1,
		})
	}

	previews := make([]RemapPreview, 0, len(oldSenses))
	for _, old := range oldSenses {
		matchID := AutoMatchSenseID(old, candidates)
		var matched SenseMatchInput
		for _, c := range candidates {
			if c.ID == matchID {
				matched = c
				break
			}
		}
		var cardCount int
		_ = s.pool.QueryRow(ctx, `
			select count(*)::int from user_word_senses
			where word_sense_id = $1::uuid and archived_at is null`,
			old.ID,
		).Scan(&cardCount)

		previews = append(previews, RemapPreview{
			WordID:        wordID,
			Lemma:         firstNonEmpty(lemma, normalized),
			PartOfSpeech:  pos,
			OldSenseID:    old.ID,
			OldDefinition: old.Definition,
			OldLocalized:  old.LocalizedDefinition,
			NewDefinition: matched.Definition,
			NewLocalized:  matched.LocalizedDefinition,
			UserCardCount: cardCount,
		})
	}
	return previews, nil
}

// RetranslateWord re-enriches a word with a fresh distinct sense set, remaps
// learner cards via AutoMatchSenseID, then deletes the old senses.
// Resume-safe: on enrich failure the old senses are left untouched.
func (s *Service) RetranslateWord(ctx context.Context, wordID string) error {
	var (
		langCode   string
		normalized string
		pos        string
	)
	err := s.pool.QueryRow(ctx, `
		select language_code, normalized_text, part_of_speech
		from words where id = $1::uuid`,
		wordID,
	).Scan(&langCode, &normalized, &pos)
	if err != nil {
		return fmt.Errorf("words: load word for retranslate: %w", err)
	}

	defLang := strings.TrimSpace(s.DefinitionLang)
	if defLang == "" {
		defLang = "ko"
	}

	oldSenses, err := loadSenseMatchInputs(ctx, s.pool, wordID, defLang)
	if err != nil {
		return err
	}
	if len(oldSenses) == 0 {
		// Still enrich so the word gets a fresh sense set.
		oldSenses = nil
	}
	oldIDs := make([]string, 0, len(oldSenses))
	oldByID := make(map[string]SenseMatchInput, len(oldSenses))
	var oldMaxOrder int
	for _, o := range oldSenses {
		oldIDs = append(oldIDs, o.ID)
		oldByID[o.ID] = o
		if o.MeaningOrder > oldMaxOrder {
			oldMaxOrder = o.MeaningOrder
		}
	}

	if s.enricher == nil {
		return fmt.Errorf("words: enricher not configured for retranslate")
	}
	result, err := s.enricher.Enrich(ctx, enrich.Request{
		Text:                   normalized,
		LanguageCode:           langCode,
		DefinitionLanguageCode: defLang,
		POS:                    pos,
		// Empty Existing → full fresh set.
	})
	if err != nil {
		return fmt.Errorf("words: retranslate enrich: %w", err)
	}

	var newSenses []enrich.Sense
	for _, entry := range result.Entries {
		if pos != "" && !strings.EqualFold(strings.TrimSpace(entry.PartOfSpeech), pos) {
			// Prefer matching POS; still accept if enricher returns only other POS.
			continue
		}
		newSenses = append(newSenses, entry.Senses...)
	}
	if len(newSenses) == 0 {
		for _, entry := range result.Entries {
			newSenses = append(newSenses, entry.Senses...)
		}
	}
	if len(newSenses) == 0 {
		return fmt.Errorf("words: retranslate produced no senses for word %s", wordID)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := appendSenses(ctx, tx, wordID, defLang, newSenses); err != nil {
		return err
	}

	candidates, err := loadNewSenseMatchInputs(ctx, tx, wordID, defLang, oldMaxOrder)
	if err != nil {
		return err
	}
	if len(candidates) == 0 {
		return fmt.Errorf("words: retranslate inserted no new senses for word %s", wordID)
	}

	if len(oldIDs) > 0 {
		for _, old := range oldSenses {
			newID := AutoMatchSenseID(old, candidates)
			var gloss string
			for _, c := range candidates {
				if c.ID == newID {
					gloss = firstNonEmpty(c.LocalizedDefinition, c.Definition)
					break
				}
			}
			s.logf("RETRANSLATE_MATCH", "word %s (%s): %q / %q → %q",
				wordID, normalized, old.Definition, old.LocalizedDefinition, gloss)
		}
		if err := remapUserWordSenses(ctx, tx, oldIDs, oldByID, candidates); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			delete from word_senses
			where word_id = $1::uuid and id = any($2::uuid[])`,
			wordID, oldIDs,
		); err != nil {
			return fmt.Errorf("words: delete old senses: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	s.logf("RETRANSLATE", "retranslated word %s (%s): %d old → %d new senses", wordID, normalized, len(oldIDs), len(candidates))
	return nil
}

func loadSenseMatchInputs(ctx context.Context, q querier, wordID, defLang string) ([]SenseMatchInput, error) {
	rows, err := q.Query(ctx, `
		select ws.id::text, ws.definition, coalesce(st.definition, ''), ws.meaning_order
		from word_senses ws
		left join sense_translations st
		  on st.word_sense_id = ws.id and st.language_code = $2
		where ws.word_id = $1::uuid
		order by ws.meaning_order, ws.id`,
		wordID, defLang,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load old senses: %w", err)
	}
	defer rows.Close()

	var out []SenseMatchInput
	for rows.Next() {
		var s SenseMatchInput
		if err := rows.Scan(&s.ID, &s.Definition, &s.LocalizedDefinition, &s.MeaningOrder); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func loadNewSenseMatchInputs(ctx context.Context, q querier, wordID, defLang string, afterOrder int) ([]SenseMatchInput, error) {
	rows, err := q.Query(ctx, `
		select ws.id::text, ws.definition, coalesce(st.definition, ''), ws.meaning_order
		from word_senses ws
		left join sense_translations st
		  on st.word_sense_id = ws.id and st.language_code = $2
		where ws.word_id = $1::uuid and ws.meaning_order > $3
		order by ws.meaning_order, ws.id`,
		wordID, defLang, afterOrder,
	)
	if err != nil {
		return nil, fmt.Errorf("words: load new senses: %w", err)
	}
	defer rows.Close()

	var out []SenseMatchInput
	for rows.Next() {
		var s SenseMatchInput
		if err := rows.Scan(&s.ID, &s.Definition, &s.LocalizedDefinition, &s.MeaningOrder); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

type remapCard struct {
	ID         string
	UserID     string
	OldSenseID string
	NewSenseID string
	AddedAt    time.Time
	ReviewCount int
	Archived   bool
}

func remapUserWordSenses(
	ctx context.Context,
	tx pgx.Tx,
	oldIDs []string,
	oldByID map[string]SenseMatchInput,
	candidates []SenseMatchInput,
) error {
	rows, err := tx.Query(ctx, `
		select uws.id::text, uws.user_id::text, uws.word_sense_id::text, uws.added_at,
		       coalesce(rs.review_count, 0), (uws.archived_at is not null)
		from user_word_senses uws
		left join review_states rs on rs.user_word_sense_id = uws.id
		where uws.word_sense_id = any($1::uuid[])`,
		oldIDs,
	)
	if err != nil {
		return fmt.Errorf("words: load cards for remap: %w", err)
	}
	defer rows.Close()

	var cards []remapCard
	for rows.Next() {
		var c remapCard
		if err := rows.Scan(&c.ID, &c.UserID, &c.OldSenseID, &c.AddedAt, &c.ReviewCount, &c.Archived); err != nil {
			return err
		}
		old, ok := oldByID[c.OldSenseID]
		if !ok {
			continue
		}
		c.NewSenseID = AutoMatchSenseID(old, candidates)
		if c.NewSenseID == "" {
			return fmt.Errorf("words: auto-match failed for sense %s", c.OldSenseID)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(cards) == 0 {
		return nil
	}

	// Group by (user_id, new_sense_id) and pick winners.
	type key struct{ userID, newSense string }
	groups := map[key][]remapCard{}
	for _, c := range cards {
		k := key{c.UserID, c.NewSenseID}
		groups[k] = append(groups[k], c)
	}

	now := time.Now().UTC()
	for k, group := range groups {
		// Also consider an existing active card already on the new sense.
		pool := append([]remapCard(nil), group...)
		var existingID string
		var existingReviews int
		var existingAdded time.Time
		err := tx.QueryRow(ctx, `
			select uws.id::text, coalesce(rs.review_count, 0), uws.added_at
			from user_word_senses uws
			left join review_states rs on rs.user_word_sense_id = uws.id
			where uws.user_id = $1::uuid
			  and uws.word_sense_id = $2::uuid
			  and uws.archived_at is null
			limit 1`,
			k.userID, k.newSense,
		).Scan(&existingID, &existingReviews, &existingAdded)
		if err == nil {
			alreadyInGroup := false
			for _, c := range pool {
				if c.ID == existingID {
					alreadyInGroup = true
					break
				}
			}
			if !alreadyInGroup {
				pool = append(pool, remapCard{
					ID:          existingID,
					UserID:      k.userID,
					NewSenseID:  k.newSense,
					AddedAt:     existingAdded,
					ReviewCount: existingReviews,
				})
			}
		} else if err != pgx.ErrNoRows {
			return fmt.Errorf("words: check existing sense card: %w", err)
		}

		winner := pickRemapWinner(pool)
		for _, c := range pool {
			if c.ID == winner.ID {
				continue
			}
			// Archive losers still on old senses; they cascade-delete with old senses.
			if _, err := tx.Exec(ctx, `
				update user_word_senses
				set archived_at = $1, updated_at = $1
				where id = $2::uuid and archived_at is null`,
				now, c.ID,
			); err != nil {
				return fmt.Errorf("words: archive remap loser: %w", err)
			}
		}

		// Winner may already be on the new sense (pre-existing); otherwise remap.
		if _, err := tx.Exec(ctx, `
			update user_word_senses
			set word_sense_id = $1::uuid, updated_at = $2
			where id = $3::uuid and word_sense_id is distinct from $1::uuid`,
			winner.NewSenseID, now, winner.ID,
		); err != nil {
			return fmt.Errorf("words: remap winner sense: %w", err)
		}
	}

	return nil
}

func pickRemapWinner(cards []remapCard) remapCard {
	best := cards[0]
	for i := 1; i < len(cards); i++ {
		c := cards[i]
		if c.ReviewCount > best.ReviewCount {
			best = c
			continue
		}
		if c.ReviewCount == best.ReviewCount && c.AddedAt.Before(best.AddedAt) {
			best = c
		}
	}
	return best
}
