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
	"project-pn/internal/email"
	"project-pn/internal/migrations"
)

func testService(t *testing.T) *Service {
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

	return New(pool, email.NewLog(), Options{
		SessionTTL:            time.Hour,
		MagicLinkTTL:          15 * time.Minute,
		ExchangeCodeTTL:       5 * time.Minute,
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		AppPublicURL:          "http://localhost:8080",
	})
}

func TestNormalizeEmail(t *testing.T) {
	t.Parallel()
	if got := NormalizeEmail("  User@Example.COM "); got != "user@example.com" {
		t.Fatalf("expected normalized email, got %q", got)
	}
}

func TestRegisterLoginLogout(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("register")

	session, err := svc.Register(ctx, emailAddr, "password123", "", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if session.Token == "" {
		t.Fatal("expected session token")
	}

	user, err := svc.Authenticate(ctx, session.Token)
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	if user.Email != emailAddr {
		t.Fatalf("expected email %q, got %q", emailAddr, user.Email)
	}

	loginSession, err := svc.Login(ctx, emailAddr, "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if loginSession.Token == "" {
		t.Fatal("expected login session token")
	}

	if err := svc.Logout(ctx, loginSession.Token); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := svc.Authenticate(ctx, loginSession.Token); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected invalid token after logout, got %v", err)
	}
}

func TestRegisterRejectsDuplicateEmailCaseInsensitive(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	base := uniqueEmail("dup")

	if _, err := svc.Register(ctx, base, "password123", "", ""); err != nil {
		t.Fatalf("first register: %v", err)
	}
	if _, err := svc.Register(ctx, "  "+base+"  ", "password456", "", ""); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
}

func TestMagicLinkE2E(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("magic")

	regSession, err := svc.Register(ctx, emailAddr, "password123", "", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	plain, hash, err := newOpaqueToken()
	if err != nil {
		t.Fatalf("new token: %v", err)
	}
	user, err := svc.Authenticate(ctx, regSession.Token)
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	_, err = svc.pool.Exec(ctx, `
		insert into magic_link_tokens (user_id, token_hash, expires_at)
		values ($1, $2, now() + interval '15 minutes')
	`, user.ID, hash)
	if err != nil {
		t.Fatalf("insert magic token: %v", err)
	}

	code, err := svc.ConsumeMagicLink(ctx, plain)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if code == "" {
		t.Fatal("expected exchange code")
	}

	session, err := svc.ExchangeMagicCode(ctx, code)
	if err != nil {
		t.Fatalf("exchange: %v", err)
	}
	if _, err := svc.Authenticate(ctx, session.Token); err != nil {
		t.Fatalf("authenticate exchanged session: %v", err)
	}

	if _, err := svc.ExchangeMagicCode(ctx, code); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected single-use exchange code, got %v", err)
	}
}

func uniqueEmail(prefix string) string {
	return prefix + "+" + time.Now().Format("150405.000000") + "@example.com"
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
