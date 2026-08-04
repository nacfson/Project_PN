package curriculum

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/admin"
	"project-pn/internal/db"
	"project-pn/internal/migrations"
	"project-pn/internal/words"
)

func repoPath(t *testing.T, parts ...string) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	base := filepath.Join(filepath.Dir(file), "..", "..")
	return filepath.Join(append([]string{base}, parts...)...)
}

func curriculumTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for curriculum tests")
	}

	ctx := context.Background()
	migrationsPath := "file://" + repoPath(t, "db", "migrations")
	if err := migrations.Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("up migration: %v", err)
	}

	pool, err := db.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(pool.Close)

	if _, err := pool.Exec(ctx, `
		TRUNCATE TABLE
			user_curriculum_enrollments,
			curriculum_pack_entries,
			curriculum_packs,
			users, words, word_senses, decks, user_languages,
			user_word_senses, review_states, review_attempts, sense_translations, examples
		CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	return pool
}

func seedPublishedPack(t *testing.T, pool *pgxpool.Pool, slug string, lemmas []string) (packID string, senseIDs []string) {
	t.Helper()
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `
		insert into curriculum_packs (slug, title, description, target_language, cefr_band, sort_order, is_published)
		values ($1, $2, 'test pack', 'en', 'A1', 1, true)
		returning id::text
	`, slug, "Test "+slug).Scan(&packID); err != nil {
		t.Fatalf("insert pack: %v", err)
	}

	for i, lemma := range lemmas {
		var wordID, senseID string
		if err := pool.QueryRow(ctx, `
			insert into words (language_code, lemma, normalized_text, part_of_speech)
			values ('en', $1, $1, 'noun')
			returning id::text
		`, lemma).Scan(&wordID); err != nil {
			t.Fatalf("insert word: %v", err)
		}
		if err := pool.QueryRow(ctx, `
			insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
			values ($1::uuid, $2, $2, 'A1', 1)
			returning id::text
		`, wordID, lemma+" definition").Scan(&senseID); err != nil {
			t.Fatalf("insert sense: %v", err)
		}
		if _, err := pool.Exec(ctx, `
			insert into sense_translations (word_sense_id, language_code, definition, short_definition)
			values ($1::uuid, 'ko', $2, $2)
		`, senseID, lemma+" 뜻"); err != nil {
			t.Fatalf("insert translation: %v", err)
		}
		if _, err := pool.Exec(ctx, `
			insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
			values ($1::uuid, $2::uuid, $3, 'A1')
		`, packID, senseID, i+1); err != nil {
			t.Fatalf("insert entry: %v", err)
		}
		senseIDs = append(senseIDs, senseID)
	}
	return packID, senseIDs
}

func curriculumTestUser(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	var userID string
	email := "curriculum-" + time.Now().Format("150405.000000") + "@example.com"
	if err := pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language, ui_language, email_verified_at)
		values ($1, 'ko', 'en', 'ko', now())
		returning id::text
	`, email).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into user_languages (user_id, target_language, display_language, is_active)
		values ($1::uuid, 'en', 'ko', true)
	`, userID); err != nil {
		t.Fatalf("insert user language: %v", err)
	}
	return userID
}

func TestListPacksAndEnrollIdempotent(t *testing.T) {
	pool := curriculumTestPool(t)
	svc := New(pool)
	userID := curriculumTestUser(t, pool)
	ctx := context.Background()

	_, _ = seedPublishedPack(t, pool, "test-a1", []string{"alpha", "beta", "gamma"})

	packs, err := svc.ListPacks(ctx, userID)
	if err != nil {
		t.Fatalf("list packs: %v", err)
	}
	if len(packs) != 1 || packs[0].Slug != "test-a1" || packs[0].EntryCount != 3 {
		t.Fatalf("unexpected packs: %+v", packs)
	}
	if packs[0].Enrolled {
		t.Fatalf("expected not enrolled")
	}

	first, err := svc.Enroll(ctx, userID, "test-a1")
	if err != nil {
		t.Fatalf("enroll: %v", err)
	}
	if first.AlreadyEnrolled || first.AddedCount != 3 || first.DeckID == "" {
		t.Fatalf("unexpected first enroll: %+v", first)
	}

	second, err := svc.Enroll(ctx, userID, "test-a1")
	if err != nil {
		t.Fatalf("reenroll: %v", err)
	}
	if !second.AlreadyEnrolled || second.DeckID != first.DeckID {
		t.Fatalf("expected idempotent enroll, got %+v", second)
	}

	packs, err = svc.ListPacks(ctx, userID)
	if err != nil {
		t.Fatalf("list after enroll: %v", err)
	}
	if !packs[0].Enrolled || packs[0].DeckID == nil || *packs[0].DeckID != first.DeckID {
		t.Fatalf("expected enrolled pack, got %+v", packs[0])
	}
}

func TestEnrollSkipsExistingPrivateSenses(t *testing.T) {
	pool := curriculumTestPool(t)
	curriculumSvc := New(pool)
	wordsSvc := words.New(pool, nil, admin.NoopLogger{}, "", "en", "en")
	userID := curriculumTestUser(t, pool)
	ctx := context.Background()

	_, senseIDs := seedPublishedPack(t, pool, "skip-pack", []string{"keep", "shared", "fresh"})

	// Add the middle sense to the private default deck first.
	if _, err := wordsSvc.AddLearningItem(ctx, userID, senseIDs[1], "en", "", ""); err != nil {
		t.Fatalf("add private item: %v", err)
	}

	var privateDeckID string
	if err := pool.QueryRow(ctx, `
		select deck_id::text from user_word_senses
		where user_id = $1::uuid and word_sense_id = $2::uuid
	`, userID, senseIDs[1]).Scan(&privateDeckID); err != nil {
		t.Fatalf("load private deck: %v", err)
	}

	result, err := curriculumSvc.Enroll(ctx, userID, "skip-pack")
	if err != nil {
		t.Fatalf("enroll: %v", err)
	}
	if result.AddedCount != 2 || result.SkippedCount != 1 {
		t.Fatalf("expected added=2 skipped=1, got %+v", result)
	}

	var afterDeckID string
	if err := pool.QueryRow(ctx, `
		select deck_id::text from user_word_senses
		where user_id = $1::uuid and word_sense_id = $2::uuid
	`, userID, senseIDs[1]).Scan(&afterDeckID); err != nil {
		t.Fatalf("reload private item deck: %v", err)
	}
	if afterDeckID != privateDeckID {
		t.Fatalf("enroll moved private item from %s to %s", privateDeckID, afterDeckID)
	}
	if afterDeckID == result.DeckID {
		t.Fatalf("private item unexpectedly in curriculum deck")
	}

	var curriculumCount int
	if err := pool.QueryRow(ctx, `
		select count(*)::int from user_word_senses
		where user_id = $1::uuid and deck_id = $2::uuid
	`, userID, result.DeckID).Scan(&curriculumCount); err != nil {
		t.Fatalf("count curriculum items: %v", err)
	}
	if curriculumCount != 2 {
		t.Fatalf("expected 2 curriculum items, got %d", curriculumCount)
	}
}

func TestDueReviewsFilterByCurriculumDeck(t *testing.T) {
	pool := curriculumTestPool(t)
	curriculumSvc := New(pool)
	wordsSvc := words.New(pool, nil, admin.NoopLogger{}, "", "en", "en")
	userID := curriculumTestUser(t, pool)
	ctx := context.Background()

	_, senseIDs := seedPublishedPack(t, pool, "due-pack", []string{"dueone", "duetwo"})
	if _, err := wordsSvc.AddLearningItem(ctx, userID, senseIDs[0], "en", "", ""); err != nil {
		t.Fatalf("add private: %v", err)
	}

	enroll, err := curriculumSvc.Enroll(ctx, userID, "due-pack")
	if err != nil {
		t.Fatalf("enroll: %v", err)
	}

	allDue, err := wordsSvc.GetDueReviewItems(ctx, userID, "", "", 50)
	if err != nil {
		t.Fatalf("due all: %v", err)
	}
	if len(allDue) < 2 {
		t.Fatalf("expected at least 2 due items overall, got %d", len(allDue))
	}

	curriculumDue, err := wordsSvc.GetDueReviewItems(ctx, userID, "", enroll.DeckID, 50)
	if err != nil {
		t.Fatalf("due curriculum: %v", err)
	}
	if len(curriculumDue) != 1 {
		t.Fatalf("expected 1 curriculum due item (skipped private overlap), got %d", len(curriculumDue))
	}
}
