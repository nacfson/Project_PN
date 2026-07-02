package auth

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

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

	if _, err := pool.Exec(ctx, `TRUNCATE TABLE users, words, word_senses, decks, user_languages, user_word_senses, review_states, review_attempts CASCADE;`); err != nil {
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

	central := CentralUser{
		ID:    "provider-id-123",
		Email: emailAddr,
	}

	user, err := svc.EnsureCentralUser(ctx, central)
	if err != nil {
		t.Fatalf("EnsureCentralUser: %v", err)
	}

	if user.Email != emailAddr {
		t.Fatalf("expected email %q, got %q", emailAddr, user.Email)
	}

	if !user.IsEmailVerified() {
		t.Fatal("expected central user to be verified locally")
	}
}

func uniqueEmail(prefix string) string {
	return prefix + "@example.com"
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
