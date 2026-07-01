package words

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/enrich"
	"project-pn/internal/migrations"
)

func deckTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for deck tests")
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

	if _, err := pool.Exec(ctx, `TRUNCATE TABLE users, words, word_senses, sessions, decks, user_languages, user_word_senses, review_states, review_attempts, sense_translations CASCADE;`); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	return pool
}

func deckTestService(t *testing.T, pool *pgxpool.Pool) *Service {
	t.Helper()
	cfg := config.Load()
	return New(pool, enrich.NewOpenAI("", "", ""), cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)
}

func deckTestUser(t *testing.T, pool *pgxpool.Pool) (userID, token string) {
	t.Helper()
	ctx := context.Background()
	emailAddr := "deck-test-" + time.Now().Format("150405.000000") + "@example.com"
	err := pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language, ui_language, email_verified_at)
		values ($1, 'ko', 'en', 'ko', now())
		returning id::text
	`, emailAddr).Scan(&userID)
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}

	// Create user_languages pair to satisfy active pair checks
	_, err = pool.Exec(ctx, `
		insert into user_languages (user_id, target_language, display_language, is_active)
		values ($1::uuid, 'en', 'ko', true)
	`, userID)
	if err != nil {
		t.Fatalf("insert test user language: %v", err)
	}

	return userID, ""
}

func insertDeckFixtureWord(t *testing.T, pool *pgxpool.Pool, lemma string) string {
	t.Helper()
	ctx := context.Background()
	var wordID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun')
		returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatalf("insert word %q: %v", lemma, err)
	}
	var senseID string
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, $2, 1)
		returning id::text
	`, wordID, lemma+" definition").Scan(&senseID); err != nil {
		t.Fatalf("insert sense %q: %v", lemma, err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', $2, $2)
	`, senseID, lemma+" translation"); err != nil {
		t.Fatalf("insert translation %q: %v", lemma, err)
	}
	return senseID
}

func TestEnsureDefaultDeckCreatesOnce(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	first, err := svc.EnsureDefaultDeck(ctx, userID, "en")
	if err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	second, err := svc.EnsureDefaultDeck(ctx, userID, "en")
	if err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if first != second {
		t.Fatalf("expected same default deck id, got %q and %q", first, second)
	}
}

func TestCreateDeckRequiresUserLanguage(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	if _, err := svc.CreateDeck(ctx, userID, "Japanese", "ja"); err != ErrInvalidTargetLanguagePair {
		t.Fatalf("expected ErrInvalidTargetLanguagePair, got %v", err)
	}
}

func TestDeleteDeckMovesItemsToDefault(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	custom, err := svc.CreateDeck(ctx, userID, "Custom", "en")
	if err != nil {
		t.Fatalf("create custom deck: %v", err)
	}

	senseID := insertDeckFixtureWord(t, pool, "deckmove")
	item, err := svc.AddLearningItem(ctx, userID, senseID, "", custom.ID)
	if err != nil {
		t.Fatalf("add item to custom deck: %v", err)
	}

	if err := svc.DeleteDeck(ctx, userID, custom.ID); err != nil {
		t.Fatalf("delete custom deck: %v", err)
	}

	defaultDeckID, err := svc.EnsureDefaultDeck(ctx, userID, "en")
	if err != nil {
		t.Fatalf("ensure default deck: %v", err)
	}

	var currentDeck string
	if err := pool.QueryRow(ctx, `select deck_id::text from user_word_senses where id = $1::uuid`, item.ID).Scan(&currentDeck); err != nil {
		t.Fatalf("fetch item deck: %v", err)
	}
	if currentDeck != defaultDeckID {
		t.Fatalf("expected item moved to default deck %q, got %q", defaultDeckID, currentDeck)
	}
}

func TestListLearningItemsFiltersByDeck(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	custom, err := svc.CreateDeck(ctx, userID, "Filter Deck", "en")
	if err != nil {
		t.Fatalf("create deck: %v", err)
	}

	senseA := insertDeckFixtureWord(t, pool, "filtera")
	senseB := insertDeckFixtureWord(t, pool, "filterb")

	if _, err := svc.AddLearningItem(ctx, userID, senseA, "", custom.ID); err != nil {
		t.Fatalf("add item A: %v", err)
	}
	if _, err := svc.AddLearningItem(ctx, userID, senseB, "", ""); err != nil {
		t.Fatalf("add item B: %v", err)
	}

	page, err := svc.ListLearningItems(ctx, userID, ListLearningItemsParams{Limit: 50, DeckID: custom.ID})
	if err != nil {
		t.Fatalf("list by deck: %v", err)
	}
	if len(page.Items) != 1 || page.Items[0].NormalizedText != "filtera" {
		t.Fatalf("expected only filtera in custom deck, got %#v", page.Items)
	}
}

func TestGetDueReviewItemsFiltersByDeck(t *testing.T) {
	pool := deckTestPool(t)
	svc := deckTestService(t, pool)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	custom, err := svc.CreateDeck(ctx, userID, "Due Deck", "en")
	if err != nil {
		t.Fatalf("create deck: %v", err)
	}

	senseA := insertDeckFixtureWord(t, pool, "duea")
	senseB := insertDeckFixtureWord(t, pool, "dueb")

	if _, err := svc.AddLearningItem(ctx, userID, senseA, "", custom.ID); err != nil {
		t.Fatalf("add item A: %v", err)
	}
	if _, err := svc.AddLearningItem(ctx, userID, senseB, "", ""); err != nil {
		t.Fatalf("add item B: %v", err)
	}

	items, err := svc.GetDueReviewItems(ctx, userID, "", custom.ID, 50)
	if err != nil {
		t.Fatalf("get due by deck: %v", err)
	}
	if len(items) != 1 || items[0].NormalizedText != "duea" {
		t.Fatalf("expected only duea in custom deck due query, got %#v", items)
	}
}

func repoPath(t *testing.T, parts ...string) string {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve current file")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
	pathParts := append([]string{root}, parts...)
	return filepath.Join(pathParts...)
}
