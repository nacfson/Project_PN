package words

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// EnsureDefaultDeck returns the default deck for a user's target language,
// creating it if necessary.
func (s *Service) EnsureDefaultDeck(ctx context.Context, userID, targetLang string) (string, error) {
	targetLang = strings.TrimSpace(targetLang)
	if targetLang == "" {
		return "", fmt.Errorf("words: ensure default deck: target language required")
	}

	var deckID string
	err := s.pool.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		values ($1::uuid, $2, $2 || ' (Default)', true)
		on conflict (user_id, target_language) where is_default = true
		do update set updated_at = now()
		returning id::text
	`, userID, targetLang).Scan(&deckID)
	if err != nil {
		return "", fmt.Errorf("words: ensure default deck: %w", err)
	}
	return deckID, nil
}

// ListDecks returns all decks for a user, optionally filtered to one target
// language. A default deck is ensured for every language pair the user has.
func (s *Service) ListDecks(ctx context.Context, userID, languageCode string) ([]Deck, error) {
	// Ensure default decks exist for every registered language pair.
	if _, err := s.pool.Exec(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		select user_id, target_language, target_language || ' (Default)', true
		from user_languages
		where user_id = $1::uuid
		  and not exists (
			  select 1 from decks d
			  where d.user_id = user_languages.user_id
			    and d.target_language = user_languages.target_language
			    and d.is_default = true
		  )
	`, userID); err != nil {
		return nil, fmt.Errorf("words: ensure default decks: %w", err)
	}

	languageCode = strings.TrimSpace(languageCode)

	rows, err := s.pool.Query(ctx, `
		select d.id::text, d.user_id::text, d.target_language, d.name, d.is_default,
		       count(uws.id) filter (where uws.archived_at is null)::int as item_count,
		       d.created_at, d.updated_at
		from decks d
		left join user_word_senses uws on uws.deck_id = d.id
		where d.user_id = $1::uuid
		  and ($2::text = '' or d.target_language = $2)
		group by d.id, d.user_id, d.target_language, d.name, d.is_default, d.created_at, d.updated_at
		order by d.target_language, d.is_default desc, d.created_at, d.id
	`, userID, languageCode)
	if err != nil {
		return nil, fmt.Errorf("words: list decks: %w", err)
	}
	defer rows.Close()

	var decks []Deck
	for rows.Next() {
		var d Deck
		if err := rows.Scan(
			&d.ID, &d.UserID, &d.TargetLanguage, &d.Name, &d.IsDefault,
			&d.ItemCount, &d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("words: scan deck: %w", err)
		}
		decks = append(decks, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("words: list decks rows: %w", err)
	}
	if decks == nil {
		decks = []Deck{}
	}
	return decks, nil
}

// CreateDeck creates a custom deck for the user.
func (s *Service) CreateDeck(ctx context.Context, userID, name, targetLang string) (Deck, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Deck{}, ErrInvalidDeckName
	}
	if len(name) > 120 {
		return Deck{}, ErrInvalidDeckName
	}

	targetLang = strings.TrimSpace(targetLang)
	if targetLang == "" {
		return Deck{}, ErrInvalidTargetLang
	}

	if err := s.requireUserLanguage(ctx, userID, targetLang); err != nil {
		return Deck{}, err
	}

	var d Deck
	err := s.pool.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		values ($1::uuid, $2, $3, false)
		returning id::text, user_id::text, target_language, name, is_default, created_at, updated_at
	`, userID, targetLang, name).Scan(
		&d.ID, &d.UserID, &d.TargetLanguage, &d.Name, &d.IsDefault, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return Deck{}, ErrDeckNameExists
		}
		return Deck{}, fmt.Errorf("words: create deck: %w", err)
	}
	d.ItemCount = 0
	return d, nil
}

// RenameDeck renames a custom or default deck owned by the user.
func (s *Service) RenameDeck(ctx context.Context, userID, deckID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrInvalidDeckName
	}
	if len(name) > 120 {
		return ErrInvalidDeckName
	}

	if err := s.requireDeckOwner(ctx, userID, deckID); err != nil {
		return err
	}

	_, err := s.pool.Exec(ctx, `
		update decks
		set name = $3, updated_at = now()
		where id = $2::uuid
		  and user_id = $1::uuid
	`, userID, deckID, name)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrDeckNameExists
		}
		return fmt.Errorf("words: rename deck: %w", err)
	}
	return nil
}

// DeleteDeck deletes a custom deck and moves its items to the default deck for
// the same target language.
func (s *Service) DeleteDeck(ctx context.Context, userID, deckID string) error {
	deck, err := s.loadDeck(ctx, userID, deckID)
	if err != nil {
		return err
	}
	if deck.IsDefault {
		return ErrCannotDeleteDefaultDeck
	}

	defaultDeckID, err := s.EnsureDefaultDeck(ctx, userID, deck.TargetLanguage)
	if err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("words: begin delete deck tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		update user_word_senses
		set deck_id = $1::uuid, updated_at = now()
		where deck_id = $2::uuid
		  and user_id = $3::uuid
	`, defaultDeckID, deckID, userID)
	if err != nil {
		return fmt.Errorf("words: move items to default deck: %w", err)
	}

	_, err = tx.Exec(ctx, `
		delete from decks
		where id = $1::uuid and user_id = $2::uuid
	`, deckID, userID)
	if err != nil {
		return fmt.Errorf("words: delete deck: %w", err)
	}

	return tx.Commit(ctx)
}

// MoveItemsToDeck moves active learning items into a deck. All items must
// belong to the user and their word language must match the deck's target
// language.
func (s *Service) MoveItemsToDeck(ctx context.Context, userID, deckID string, itemIDs []string) error {
	if len(itemIDs) == 0 {
		return nil
	}

	deck, err := s.loadDeck(ctx, userID, deckID)
	if err != nil {
		return err
	}

	rows, err := s.pool.Query(ctx, `
		update user_word_senses uws
		set deck_id = $1::uuid, updated_at = now()
		where uws.id = any($2::uuid[])
		  and uws.user_id = $3::uuid
		  and uws.archived_at is null
		  and exists (
			  select 1 from word_senses ws
			  join words w on w.id = ws.word_id
			  where ws.id = uws.word_sense_id
			    and w.language_code = $4
		  )
		returning uws.id::text
	`, deckID, itemIDs, userID, deck.TargetLanguage)
	if err != nil {
		return fmt.Errorf("words: move items to deck: %w", err)
	}
	defer rows.Close()

	moved := 0
	for rows.Next() {
		moved++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("words: move items to deck rows: %w", err)
	}
	if moved != len(itemIDs) {
		return ErrDeckLanguageMismatch
	}
	return nil
}

// resolveDeckForAdd validates a requested deck or returns the default deck for
// the given word language.
func (s *Service) resolveDeckForAdd(ctx context.Context, userID, requestedDeckID, wordLang string) (string, error) {
	if strings.TrimSpace(requestedDeckID) == "" {
		return s.EnsureDefaultDeck(ctx, userID, wordLang)
	}

	deck, err := s.loadDeck(ctx, userID, requestedDeckID)
	if err != nil {
		return "", err
	}
	if deck.TargetLanguage != wordLang {
		return "", ErrDeckLanguageMismatch
	}
	return deck.ID, nil
}

// loadDeck returns a deck only if it belongs to the user.
func (s *Service) loadDeck(ctx context.Context, userID, deckID string) (Deck, error) {
	var d Deck
	err := s.pool.QueryRow(ctx, `
		select id::text, user_id::text, target_language, name, is_default, created_at, updated_at
		from decks
		where id = $1::uuid and user_id = $2::uuid
	`, deckID, userID).Scan(
		&d.ID, &d.UserID, &d.TargetLanguage, &d.Name, &d.IsDefault, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Deck{}, ErrDeckNotFound
		}
		return Deck{}, fmt.Errorf("words: load deck: %w", err)
	}
	return d, nil
}

// requireDeckOwner returns ErrDeckNotFound if the deck does not exist or does
// not belong to the user.
func (s *Service) requireDeckOwner(ctx context.Context, userID, deckID string) error {
	_, err := s.loadDeck(ctx, userID, deckID)
	return err
}

// requireUserLanguage verifies the user has a language pair for the target.
func (s *Service) requireUserLanguage(ctx context.Context, userID, targetLang string) error {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		select exists(
			select 1 from user_languages
			where user_id = $1::uuid and target_language = $2
		)
	`, userID, targetLang).Scan(&exists)
	if err != nil {
		return fmt.Errorf("words: check user language: %w", err)
	}
	if !exists {
		return ErrInvalidTargetLanguagePair
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
