package auth

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"project-pn/internal/db"
	"project-pn/internal/migrations"
)

func testService(t *testing.T) *Service {
	t.Helper()
	return testServiceWithOptions(t, Options{
		DefaultDefinitionLang:  "ko",
		DefaultTargetLang:      "en",
		DefaultUILang:          "en",
		AllowedDefinitionLangs: nil,
		AllowedTargetLangs:     nil,
		AllowedUILangs:         nil,
		ForceDefinitionLang:    "",
		ForceTargetLang:        "",
		ForceUILang:            "",
	})
}

func testServiceWithOptions(t *testing.T, opts Options) *Service {
	t.Helper()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for auth integration tests")
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

	if _, err := pool.Exec(ctx, `TRUNCATE TABLE users, words, word_senses, decks, user_languages, user_word_senses, review_states, review_attempts, user_identities, account_merge_requests CASCADE;`); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	return New(pool, opts)
}

func TestNormalizeEmail(t *testing.T) {
	t.Parallel()
	if got := NormalizeEmail("  User@Example.COM "); got != "user@example.com" {
		t.Fatalf("expected normalized email, got %q", got)
	}
}

func TestEnsureCentralUser(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("central")

	central := SessionFromCentralUser(CentralUser{
		ID:    "provider-id-123",
		Email: emailAddr,
	}, "google")

	result, err := svc.EnsureCentralUser(ctx, central)
	if err != nil {
		t.Fatalf("EnsureCentralUser: %v", err)
	}
	user := result.User

	if user.Email != emailAddr {
		t.Fatalf("expected email %q, got %q", emailAddr, user.Email)
	}

	if !user.IsEmailVerified() {
		t.Fatal("expected central user to be verified locally")
	}
}

func uniqueEmail(prefix string) string {
	return prefix + "-" + time.Now().Format("150405.000000000") + "@example.com"
}

func TestResolveTargetLangRejectsInvalid(t *testing.T) {
	s := New(nil, Options{AllowedTargetLangs: []string{"en", "ja"}})
	_, err := s.resolveTargetLang("<script>")
	if !errors.Is(err, ErrInvalidTargetLang) {
		t.Fatalf("expected invalid target language, got %v", err)
	}
}

func TestRemoveUserLanguageRejectsInvalid(t *testing.T) {
	s := New(nil, Options{AllowedTargetLangs: []string{"en", "ja"}})
	err := s.RemoveUserLanguage(context.Background(), "any-user-id", "<script>")
	if !errors.Is(err, ErrInvalidTargetLang) {
		t.Fatalf("expected invalid target language, got %v", err)
	}
}

func TestMergeUsersTxMergesDefaultDecksAndDeduplicatesCustomCards(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	var targetUserID, sourceUserID string
	if err := svc.pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language, email_verified_at)
		values ($1, 'ko', 'en', now()) returning id::text
	`, uniqueEmail("merge-tgt")).Scan(&targetUserID); err != nil {
		t.Fatalf("insert target user: %v", err)
	}
	if err := svc.pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language, email_verified_at)
		values ($1, 'ko', 'en', now()) returning id::text
	`, uniqueEmail("merge-src")).Scan(&sourceUserID); err != nil {
		t.Fatalf("insert source user: %v", err)
	}

	var tgtDeckID, srcDeckID, tgtNamedDeckID, srcNamedDeckID string
	if err := svc.pool.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		values ($1::uuid, 'en', 'en (Default)', true) returning id::text
	`, targetUserID).Scan(&tgtDeckID); err != nil {
		t.Fatalf("insert target default deck: %v", err)
	}
	if err := svc.pool.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		values ($1::uuid, 'en', 'en (Default)', true) returning id::text
	`, sourceUserID).Scan(&srcDeckID); err != nil {
		t.Fatalf("insert source default deck: %v", err)
	}
	if err := svc.pool.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		values ($1::uuid, 'en', 'Travel', false) returning id::text
	`, targetUserID).Scan(&tgtNamedDeckID); err != nil {
		t.Fatalf("insert target named deck: %v", err)
	}
	if err := svc.pool.QueryRow(ctx, `
		insert into decks (user_id, target_language, name, is_default)
		values ($1::uuid, 'en', 'travel', false) returning id::text
	`, sourceUserID).Scan(&srcNamedDeckID); err != nil {
		t.Fatalf("insert source named deck: %v", err)
	}

	insertCustom := func(userID, deckID, lemma, pos, meaning string, archived bool) string {
		t.Helper()
		var uwsID string
		var archivedExpr interface{}
		stage := "new"
		if archived {
			archivedExpr = time.Now().UTC()
			stage = "archived"
		}
		if err := svc.pool.QueryRow(ctx, `
			insert into user_word_senses (user_id, word_sense_id, deck_id, archived_at, learning_stage)
			values ($1::uuid, null, $2::uuid, $3, $4) returning id::text
		`, userID, deckID, archivedExpr, stage).Scan(&uwsID); err != nil {
			t.Fatalf("insert custom uws: %v", err)
		}
		if _, err := svc.pool.Exec(ctx, `
			insert into user_personal_meanings (user_word_sense_id, lemma, part_of_speech, meaning)
			values ($1::uuid, $2, $3, $4)
		`, uwsID, lemma, pos, meaning); err != nil {
			t.Fatalf("insert custom pm: %v", err)
		}
		if _, err := svc.pool.Exec(ctx, `insert into review_states (user_word_sense_id) values ($1::uuid)`, uwsID); err != nil {
			t.Fatalf("insert review state: %v", err)
		}
		return uwsID
	}

	tgtCollision := insertCustom(targetUserID, tgtDeckID, "Glorp", "noun", "target meaning", false)
	insertCustom(sourceUserID, srcDeckID, "glorp", "noun", "source duplicate", false)
	srcDiffPos := insertCustom(sourceUserID, srcDeckID, "glorp", "verb", "source verb meaning", false)
	srcUnique := insertCustom(sourceUserID, srcDeckID, "Snorf", "noun", "source unique", false)
	srcNamedActive := insertCustom(sourceUserID, srcNamedDeckID, "Bramble", "noun", "active travel word", false)
	srcNamedArchived := insertCustom(sourceUserID, srcNamedDeckID, "Thicket", "noun", "archived travel word", true)

	tx, err := svc.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx)
	if err := mergeUsersTx(ctx, tx, targetUserID, sourceUserID); err != nil {
		t.Fatalf("mergeUsersTx: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit merge: %v", err)
	}

	var count int
	if err := svc.pool.QueryRow(ctx, `
		select count(*) from user_word_senses where user_id = $1::uuid and word_sense_id is null
	`, targetUserID).Scan(&count); err != nil {
		t.Fatalf("count merged custom cards: %v", err)
	}
	if count != 5 {
		t.Fatalf("expected 5 merged custom cards (1 kept + 4 moved incl. diff-POS & archived), got %d", count)
	}

	var tgtMeaning string
	if err := svc.pool.QueryRow(ctx, `select meaning from user_personal_meanings where user_word_sense_id = $1::uuid`, tgtCollision).Scan(&tgtMeaning); err != nil {
		t.Fatalf("load kept target card: %v", err)
	}
	if tgtMeaning != "target meaning" {
		t.Fatalf("expected target card meaning preserved, got %q", tgtMeaning)
	}

	for _, tc := range []struct {
		name, id, wantDeck string
	}{
		{name: "default deck unique", id: srcUnique, wantDeck: tgtDeckID},
		{name: "same-lemma different-pos", id: srcDiffPos, wantDeck: tgtDeckID},
		{name: "named deck active", id: srcNamedActive, wantDeck: tgtNamedDeckID},
		{name: "named deck archived", id: srcNamedArchived, wantDeck: tgtNamedDeckID},
	} {
		var movedDeckID, movedUserID string
		if err := svc.pool.QueryRow(ctx, `select user_id::text, deck_id::text from user_word_senses where id = $1::uuid`, tc.id).Scan(&movedUserID, &movedDeckID); err != nil {
			t.Fatalf("load moved %s card: %v", tc.name, err)
		}
		if movedUserID != targetUserID || movedDeckID != tc.wantDeck {
			t.Fatalf("%s: expected user=%q deck=%q, got user=%q deck=%q", tc.name, targetUserID, tc.wantDeck, movedUserID, movedDeckID)
		}
	}

	var remainingSourceDecks int
	if err := svc.pool.QueryRow(ctx, `select count(*) from decks where user_id = $1::uuid`, sourceUserID).Scan(&remainingSourceDecks); err != nil {
		t.Fatalf("count remaining source decks: %v", err)
	}
	if remainingSourceDecks != 0 {
		t.Fatalf("expected all colliding source decks deleted, got %d", remainingSourceDecks)
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
