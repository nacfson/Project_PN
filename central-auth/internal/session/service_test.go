package session

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/nacfson/central-auth/internal/config"
	"github.com/nacfson/central-auth/internal/db"
)

func testService(t *testing.T) *Service {
	t.Helper()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for session tests")
	}
	pool, err := db.Open(context.Background(), databaseURL)
	if err != nil {
		t.Skipf("database unavailable: %v", err)
	}
	t.Cleanup(pool.Close)
	m, err := migrate.New("file://../../db/migrations", databaseURL)
	if err != nil {
		t.Fatalf("migrate new: %v", err)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("migrate up: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `truncate magic_link_tokens, sessions, users restart identity cascade`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	cfg := config.Config{
		AccessTokenTTL:     time.Hour,
		RefreshTokenTTL:      90 * 24 * time.Hour,
		SessionIdleTimeout:   7 * 24 * time.Hour,
		SessionMaxAge:        30 * 24 * time.Hour,
		MagicLinkTTL:         15 * time.Minute,
	}
	return NewService(pool, cfg)
}

func TestRefreshRotatesTokens(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	user, err := svc.EnsureUser(ctx, "refresh@example.com")
	if err != nil {
		t.Fatalf("ensure user: %v", err)
	}
	initial, err := svc.createSession(ctx, user, false, "magic_link", user.ID)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	refreshed, err := svc.Refresh(ctx, initial.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if refreshed.AccessToken == initial.AccessToken || refreshed.RefreshToken == initial.RefreshToken {
		t.Fatalf("expected rotated tokens, got %+v", refreshed)
	}
	if _, err := svc.Refresh(ctx, initial.RefreshToken); err == nil {
		t.Fatal("expected reused refresh token to fail")
	}
}

func TestCookieSessionSlidesExpiry(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	user, err := svc.EnsureUser(ctx, "cookie@example.com")
	if err != nil {
		t.Fatalf("ensure user: %v", err)
	}
	creds, err := svc.createSession(ctx, user, true, "magic_link", user.ID)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	first, err := svc.ValidateCookie(ctx, creds.CookieValue)
	if err != nil {
		t.Fatalf("validate cookie: %v", err)
	}
	svc.cfg.SessionIdleTimeout = 2 * time.Hour
	second, err := svc.ValidateCookie(ctx, creds.CookieValue)
	if err != nil {
		t.Fatalf("validate cookie again: %v", err)
	}
	if !second.AccessExpiresAt.After(first.AccessExpiresAt) {
		t.Fatalf("expected sliding expiry, first=%s second=%s", first.AccessExpiresAt, second.AccessExpiresAt)
	}
}
