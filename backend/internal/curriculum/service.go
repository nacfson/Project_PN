package curriculum

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPackNotFound = errors.New("curriculum: pack not found")
)

// Service implements curriculum pack catalog and enroll flows.
type Service struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// ListPacks returns published packs with enrollment status for the user.
func (s *Service) ListPacks(ctx context.Context, userID string) ([]Pack, error) {
	rows, err := s.pool.Query(ctx, `
		select
			p.id::text,
			p.slug,
			p.title,
			p.description,
			p.target_language,
			p.cefr_band,
			p.sort_order,
			(select count(*)::int from curriculum_pack_entries e where e.pack_id = p.id) as entry_count,
			(uce.deck_id is not null) as enrolled,
			uce.deck_id::text,
			coalesce((
				select count(*)::int
				from curriculum_pack_entries e
				join user_word_senses uws
				  on uws.word_sense_id = e.word_sense_id
				 and uws.user_id = $1::uuid
				 and uws.archived_at is null
				where e.pack_id = p.id
			), 0) as added_count,
			p.created_at,
			p.updated_at
		from curriculum_packs p
		left join user_curriculum_enrollments uce
		  on uce.pack_id = p.id and uce.user_id = $1::uuid
		where p.is_published = true
		order by p.sort_order, p.slug
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("curriculum: list packs: %w", err)
	}
	defer rows.Close()

	var packs []Pack
	for rows.Next() {
		var p Pack
		var deckID *string
		if err := rows.Scan(
			&p.ID, &p.Slug, &p.Title, &p.Description, &p.TargetLanguage, &p.CEFRBand, &p.SortOrder,
			&p.EntryCount, &p.Enrolled, &deckID, &p.AddedCount, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("curriculum: scan pack: %w", err)
		}
		p.DeckID = deckID
		if p.EntryCount > p.AddedCount {
			p.SkippedCount = 0
		}
		// Skipped = pack entries the user already had outside curriculum enroll adds.
		// Approximate as entry_count - items currently in the curriculum deck when enrolled.
		if p.Enrolled && deckID != nil {
			var inDeck int
			if err := s.pool.QueryRow(ctx, `
				select count(*)::int
				from user_word_senses
				where user_id = $1::uuid
				  and deck_id = $2::uuid
				  and archived_at is null
			`, userID, *deckID).Scan(&inDeck); err != nil {
				return nil, fmt.Errorf("curriculum: count deck items: %w", err)
			}
			p.SkippedCount = p.EntryCount - inDeck
			if p.SkippedCount < 0 {
				p.SkippedCount = 0
			}
		}
		packs = append(packs, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("curriculum: list packs rows: %w", err)
	}
	if packs == nil {
		packs = []Pack{}
	}
	return packs, nil
}

// GetPack returns pack detail with a capped entry preview.
func (s *Service) GetPack(ctx context.Context, userID, slug string, previewLimit int) (PackDetail, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return PackDetail{}, ErrPackNotFound
	}
	if previewLimit <= 0 || previewLimit > 100 {
		previewLimit = 50
	}

	var detail PackDetail
	var deckID *string
	err := s.pool.QueryRow(ctx, `
		select
			p.id::text,
			p.slug,
			p.title,
			p.description,
			p.target_language,
			p.cefr_band,
			p.sort_order,
			(select count(*)::int from curriculum_pack_entries e where e.pack_id = p.id) as entry_count,
			(uce.deck_id is not null) as enrolled,
			uce.deck_id::text,
			p.created_at,
			p.updated_at
		from curriculum_packs p
		left join user_curriculum_enrollments uce
		  on uce.pack_id = p.id and uce.user_id = $1::uuid
		where p.slug = $2 and p.is_published = true
	`, userID, slug).Scan(
		&detail.ID, &detail.Slug, &detail.Title, &detail.Description, &detail.TargetLanguage,
		&detail.CEFRBand, &detail.SortOrder, &detail.EntryCount, &detail.Enrolled, &deckID,
		&detail.CreatedAt, &detail.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PackDetail{}, ErrPackNotFound
		}
		return PackDetail{}, fmt.Errorf("curriculum: get pack: %w", err)
	}
	detail.DeckID = deckID
	detail.EntriesTotal = detail.EntryCount

	if err := s.pool.QueryRow(ctx, `
		select count(*)::int
		from curriculum_pack_entries e
		join user_word_senses uws
		  on uws.word_sense_id = e.word_sense_id
		 and uws.user_id = $1::uuid
		 and uws.archived_at is null
		where e.pack_id = $2::uuid
	`, userID, detail.ID).Scan(&detail.AddedCount); err != nil {
		return PackDetail{}, fmt.Errorf("curriculum: count added: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		select
			e.word_sense_id::text,
			w.lemma,
			w.part_of_speech,
			ws.short_definition,
			ws.definition,
			coalesce(e.cefr_level, ws.cefr_level),
			e.sort_order,
			exists(
				select 1 from user_word_senses uws
				where uws.user_id = $1::uuid
				  and uws.word_sense_id = e.word_sense_id
				  and uws.archived_at is null
			) as already_learning
		from curriculum_pack_entries e
		join word_senses ws on ws.id = e.word_sense_id
		join words w on w.id = ws.word_id
		where e.pack_id = $2::uuid
		order by e.sort_order, e.id
		limit $3
	`, userID, detail.ID, previewLimit)
	if err != nil {
		return PackDetail{}, fmt.Errorf("curriculum: list entries: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var entry PackEntry
		if err := rows.Scan(
			&entry.WordSenseID, &entry.Lemma, &entry.PartOfSpeech, &entry.ShortDefinition,
			&entry.Definition, &entry.CEFRLevel, &entry.SortOrder, &entry.AlreadyLearning,
		); err != nil {
			return PackDetail{}, fmt.Errorf("curriculum: scan entry: %w", err)
		}
		detail.Entries = append(detail.Entries, entry)
	}
	if err := rows.Err(); err != nil {
		return PackDetail{}, fmt.Errorf("curriculum: entries rows: %w", err)
	}
	if detail.Entries == nil {
		detail.Entries = []PackEntry{}
	}
	return detail, nil
}

// Enroll creates an isolated curriculum deck and adds missing senses.
// Existing private learning items are never moved.
func (s *Service) Enroll(ctx context.Context, userID, slug string) (EnrollResult, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return EnrollResult{}, ErrPackNotFound
	}

	var packID, title, targetLang string
	err := s.pool.QueryRow(ctx, `
		select id::text, title, target_language
		from curriculum_packs
		where slug = $1 and is_published = true
	`, slug).Scan(&packID, &title, &targetLang)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return EnrollResult{}, ErrPackNotFound
		}
		return EnrollResult{}, fmt.Errorf("curriculum: load pack: %w", err)
	}

	// Idempotent: return existing enrollment.
	var existingDeckID string
	err = s.pool.QueryRow(ctx, `
		select deck_id::text
		from user_curriculum_enrollments
		where user_id = $1::uuid and pack_id = $2::uuid
	`, userID, packID).Scan(&existingDeckID)
	if err == nil {
		var added, skipped int
		added, skipped, err = s.countEnrollProgress(ctx, userID, packID, existingDeckID)
		if err != nil {
			return EnrollResult{}, err
		}
		return EnrollResult{
			PackID:          packID,
			Slug:            slug,
			DeckID:          existingDeckID,
			AddedCount:      added,
			SkippedCount:    skipped,
			AlreadyEnrolled: true,
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return EnrollResult{}, fmt.Errorf("curriculum: check enrollment: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: begin enroll tx: %w", err)
	}
	defer tx.Rollback(ctx)

	deckName := "Curriculum: " + title
	var deckID string
	err = tx.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default, origin, curriculum_pack_id)
		values ($1::uuid, $2, $3, false, 'curriculum', $4::uuid)
		on conflict (user_id, curriculum_pack_id) where curriculum_pack_id is not null
		do update set updated_at = now()
		returning id::text
	`, userID, targetLang, deckName, packID).Scan(&deckID)
	if err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: create deck: %w", err)
	}

	// Insert only senses the user does not already have. Never update deck_id on conflict.
	tag, err := tx.Exec(ctx, `
		insert into user_word_senses (user_id, word_sense_id, deck_id)
		select $1::uuid, e.word_sense_id, $2::uuid
		from curriculum_pack_entries e
		where e.pack_id = $3::uuid
		  and not exists (
			select 1 from user_word_senses uws
			where uws.user_id = $1::uuid
			  and uws.word_sense_id = e.word_sense_id
		  )
		on conflict (user_id, word_sense_id) do nothing
	`, userID, deckID, packID)
	if err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: insert learning items: %w", err)
	}
	added := int(tag.RowsAffected())

	_, err = tx.Exec(ctx, `
		insert into review_states (user_word_sense_id)
		select uws.id
		from user_word_senses uws
		where uws.user_id = $1::uuid
		  and uws.deck_id = $2::uuid
		  and not exists (
			select 1 from review_states rs where rs.user_word_sense_id = uws.id
		  )
	`, userID, deckID)
	if err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: insert review states: %w", err)
	}

	_, err = tx.Exec(ctx, `
		insert into user_curriculum_enrollments (user_id, pack_id, deck_id)
		values ($1::uuid, $2::uuid, $3::uuid)
		on conflict (user_id, pack_id) do update
		  set deck_id = excluded.deck_id, updated_at = now()
	`, userID, packID, deckID)
	if err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: upsert enrollment: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: commit enroll: %w", err)
	}

	var entryCount int
	if err := s.pool.QueryRow(ctx, `
		select count(*)::int from curriculum_pack_entries where pack_id = $1::uuid
	`, packID).Scan(&entryCount); err != nil {
		return EnrollResult{}, fmt.Errorf("curriculum: count entries: %w", err)
	}
	skipped := entryCount - added
	if skipped < 0 {
		skipped = 0
	}

	return EnrollResult{
		PackID:          packID,
		Slug:            slug,
		DeckID:          deckID,
		AddedCount:      added,
		SkippedCount:    skipped,
		AlreadyEnrolled: false,
	}, nil
}

func (s *Service) countEnrollProgress(ctx context.Context, userID, packID, deckID string) (added, skipped int, err error) {
	var entryCount, inDeck int
	if err = s.pool.QueryRow(ctx, `
		select count(*)::int from curriculum_pack_entries where pack_id = $1::uuid
	`, packID).Scan(&entryCount); err != nil {
		return 0, 0, fmt.Errorf("curriculum: count entries: %w", err)
	}
	if err = s.pool.QueryRow(ctx, `
		select count(*)::int
		from user_word_senses
		where user_id = $1::uuid and deck_id = $2::uuid and archived_at is null
	`, userID, deckID).Scan(&inDeck); err != nil {
		return 0, 0, fmt.Errorf("curriculum: count deck items: %w", err)
	}
	skipped = entryCount - inDeck
	if skipped < 0 {
		skipped = 0
	}
	return inDeck, skipped, nil
}
