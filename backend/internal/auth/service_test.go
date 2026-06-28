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
	return testServiceWithOptions(t, Options{
		SessionTTL:             time.Hour,
		EmailVerificationTTL:   24 * time.Hour,
		DefaultDefinitionLang:  "ko",
		DefaultTargetLang:      "en",
		DefaultUILang:          "en",
		AllowedDefinitionLangs: nil,
		AllowedTargetLangs:     nil,
		AllowedUILangs:         nil,
		ForceDefinitionLang:    "",
		ForceTargetLang:        "",
		ForceUILang:            "",
		AppPublicURL:           "http://localhost:8080",
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

	return New(pool, email.NewLog(), opts)
}

func TestNormalizeEmail(t *testing.T) {
	t.Parallel()
	if got := NormalizeEmail("  User@Example.COM "); got != "user@example.com" {
		t.Fatalf("expected normalized email, got %q", got)
	}
}

func TestRegisterDoesNotIssueSession(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("register")

	if err := svc.Register(ctx, emailAddr, "password123", "", "", ""); err != nil {
		t.Fatalf("register: %v", err)
	}

	var userID string
	var verifiedAt *time.Time
	if err := svc.pool.QueryRow(ctx, `
		select id, email_verified_at from users where lower(email) = $1
	`, emailAddr).Scan(&userID, &verifiedAt); err != nil {
		t.Fatalf("lookup user: %v", err)
	}
	if verifiedAt != nil {
		t.Fatal("expected newly registered user to be unverified")
	}

	var tokenCount int
	if err := svc.pool.QueryRow(ctx, `
		select count(*) from email_verification_tokens where user_id = $1
	`, userID).Scan(&tokenCount); err != nil {
		t.Fatalf("count verification tokens: %v", err)
	}
	if tokenCount != 1 {
		t.Fatalf("expected one verification token, got %d", tokenCount)
	}
}

func TestLoginBlocksUnverifiedEmail(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("unverified")

	if err := svc.Register(ctx, emailAddr, "password123", "", "", ""); err != nil {
		t.Fatalf("register: %v", err)
	}

	if _, err := svc.Login(ctx, emailAddr, "password123"); !errors.Is(err, ErrEmailNotVerified) {
		t.Fatalf("expected ErrEmailNotVerified, got %v", err)
	}
}

func TestVerificationTokenE2E(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("verify")

	if err := svc.Register(ctx, emailAddr, "password123", "", "", ""); err != nil {
		t.Fatalf("register: %v", err)
	}

	plain, err := svc.InsertVerificationTokenForTest(ctx, emailAddr)
	if err != nil {
		t.Fatalf("insert verification token: %v", err)
	}

	verifiedEmail, err := svc.ConsumeVerificationToken(ctx, plain)
	if err != nil {
		t.Fatalf("consume verification token: %v", err)
	}
	if verifiedEmail != emailAddr {
		t.Fatalf("expected email %q, got %q", emailAddr, verifiedEmail)
	}

	var verifiedAt *time.Time
	if err := svc.pool.QueryRow(ctx, `select email_verified_at from users where lower(email) = $1`, emailAddr).Scan(&verifiedAt); err != nil {
		t.Fatalf("lookup verified at: %v", err)
	}
	if verifiedAt == nil {
		t.Fatal("expected email to be verified")
	}

	session, err := svc.Login(ctx, emailAddr, "password123")
	if err != nil {
		t.Fatalf("login after verification: %v", err)
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
	if !user.IsEmailVerified() {
		t.Fatal("expected verified user")
	}

	if _, err := svc.ConsumeVerificationToken(ctx, plain); !errors.Is(err, ErrVerificationTokenInvalid) {
		t.Fatalf("expected single-use verification token, got %v", err)
	}
}

func TestEnsureCentralUserCreatesAndReusesMappedProfile(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("central")
	central := CentralUser{
		ID:    "brain-user-" + emailAddr,
		Email: emailAddr,
	}

	user, err := svc.EnsureCentralUser(ctx, central)
	if err != nil {
		t.Fatalf("EnsureCentralUser create: %v", err)
	}
	if user.ID == "" {
		t.Fatal("expected local user id")
	}
	if user.Email != emailAddr {
		t.Fatalf("expected email %q, got %q", emailAddr, user.Email)
	}
	if !user.IsEmailVerified() {
		t.Fatal("expected central user to be verified locally")
	}
	if user.ActiveLanguage.TargetLanguage == "" {
		t.Fatal("expected active language")
	}

	again, err := svc.EnsureCentralUser(ctx, central)
	if err != nil {
		t.Fatalf("EnsureCentralUser reuse: %v", err)
	}
	if again.ID != user.ID {
		t.Fatalf("expected reused local user %q, got %q", user.ID, again.ID)
	}

	var providerSubject string
	if err := svc.pool.QueryRow(ctx, `
		select provider_subject
		from user_identities
		where user_id = $1::uuid and provider = $2
	`, user.ID, centralIdentityProvider).Scan(&providerSubject); err != nil {
		t.Fatalf("lookup central identity: %v", err)
	}
	if providerSubject != central.ID {
		t.Fatalf("expected provider subject %q, got %q", central.ID, providerSubject)
	}
}

func TestRegisterRespectsForcedLanguages(t *testing.T) {
	svc := testServiceWithOptions(t, Options{
		SessionTTL:             time.Hour,
		EmailVerificationTTL:   24 * time.Hour,
		DefaultDefinitionLang:  "ko",
		DefaultTargetLang:      "en",
		AllowedDefinitionLangs: nil,
		AllowedTargetLangs:     nil,
		ForceDefinitionLang:    "ja",
		ForceTargetLang:        "es",
		AppPublicURL:           "http://localhost:8080",
	})
	ctx := context.Background()
	emailAddr := uniqueEmail("forced-langs")

	if err := svc.Register(ctx, emailAddr, "password123", "fr", "de", ""); err != nil {
		t.Fatalf("register: %v", err)
	}

	var nativeLang, targetLang string
	if err := svc.pool.QueryRow(ctx, `
		select native_language, target_language from users where lower(email) = $1
	`, emailAddr).Scan(&nativeLang, &targetLang); err != nil {
		t.Fatalf("lookup user: %v", err)
	}
	if nativeLang != "ja" {
		t.Fatalf("expected forced native language ja, got %q", nativeLang)
	}
	if targetLang != "es" {
		t.Fatalf("expected forced target language es, got %q", targetLang)
	}
}

func TestRegisterRejectsDisallowedLanguages(t *testing.T) {
	svc := testServiceWithOptions(t, Options{
		SessionTTL:             time.Hour,
		EmailVerificationTTL:   24 * time.Hour,
		DefaultDefinitionLang:  "ko",
		DefaultTargetLang:      "en",
		AllowedDefinitionLangs: []string{"ko", "en"},
		AllowedTargetLangs:     []string{"en", "ja"},
		ForceDefinitionLang:    "",
		ForceTargetLang:        "",
		AppPublicURL:           "http://localhost:8080",
	})
	ctx := context.Background()

	if err := svc.Register(ctx, uniqueEmail("bad-target"), "password123", "ko", "es", ""); !errors.Is(err, ErrInvalidTargetLang) {
		t.Fatalf("expected ErrInvalidTargetLang, got %v", err)
	}
	if err := svc.Register(ctx, uniqueEmail("bad-native"), "password123", "fr", "en", ""); !errors.Is(err, ErrInvalidDefinitionLang) {
		t.Fatalf("expected ErrInvalidDefinitionLang, got %v", err)
	}
}

func TestLanguageOptions(t *testing.T) {
	svc := testServiceWithOptions(t, Options{
		SessionTTL:             time.Hour,
		EmailVerificationTTL:   24 * time.Hour,
		DefaultDefinitionLang:  "ko",
		DefaultTargetLang:      "en",
		AllowedDefinitionLangs: []string{"ko", "en", "ja"},
		AllowedTargetLangs:     []string{"en", "ja", "es"},
		ForceDefinitionLang:    "",
		ForceTargetLang:        "",
		AppPublicURL:           "http://localhost:8080",
	})

	opts := svc.LanguageOptions()
	if opts.Defaults.TargetLanguage != "en" || opts.Defaults.DefinitionLanguage != "ko" {
		t.Fatalf("unexpected defaults: %+v", opts.Defaults)
	}
	if len(opts.Allowed.TargetLanguages) != 3 || len(opts.Allowed.DefinitionLanguages) != 3 {
		t.Fatalf("unexpected allowed lists: %+v", opts.Allowed)
	}
	if opts.Forced.TargetLanguage != "" || opts.Forced.DefinitionLanguage != "" {
		t.Fatalf("unexpected forced values: %+v", opts.Forced)
	}
}

func TestRegisterRejectsDuplicateEmailCaseInsensitive(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	base := uniqueEmail("dup")

	if err := svc.Register(ctx, base, "password123", "", "", ""); err != nil {
		t.Fatalf("first register: %v", err)
	}
	if err := svc.Register(ctx, "  "+base+"  ", "password456", "", "", ""); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
}

func TestSendVerificationEmailDoesNotLeakExistence(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	if err := svc.SendVerificationEmail(ctx, uniqueEmail("does-not-exist")); err != nil {
		t.Fatalf("expected nil for unknown email, got %v", err)
	}

	verifiedEmail := uniqueEmail("already-verified")
	if err := svc.Register(ctx, verifiedEmail, "password123", "", "", ""); err != nil {
		t.Fatalf("register: %v", err)
	}
	if _, err := svc.pool.Exec(ctx, `
		update users set email_verified_at = now() where lower(email) = $1
	`, verifiedEmail); err != nil {
		t.Fatalf("mark verified: %v", err)
	}
	if err := svc.SendVerificationEmail(ctx, verifiedEmail); err != nil {
		t.Fatalf("expected nil for verified email, got %v", err)
	}
}

func TestRegisterCreatesActiveUserLanguage(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("register-user-lang")

	if err := svc.Register(ctx, emailAddr, "password123", "ko", "en", ""); err != nil {
		t.Fatalf("register: %v", err)
	}

	user, err := svc.Authenticate(ctx, mustLogin(t, svc, ctx, emailAddr, "password123"))
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	if user.ActiveLanguage.TargetLanguage != "en" {
		t.Fatalf("expected active target en, got %q", user.ActiveLanguage.TargetLanguage)
	}
	if user.ActiveLanguage.DisplayLanguage != "ko" {
		t.Fatalf("expected active display ko, got %q", user.ActiveLanguage.DisplayLanguage)
	}
	if !user.ActiveLanguage.IsActive {
		t.Fatal("expected active language to be active")
	}

	langs, err := svc.GetUserLanguages(ctx, user.ID)
	if err != nil {
		t.Fatalf("get user languages: %v", err)
	}
	if len(langs) != 1 {
		t.Fatalf("expected 1 language, got %d", len(langs))
	}
}

func TestAddAndSwitchUserLanguage(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("switch-lang")

	if err := svc.Register(ctx, emailAddr, "password123", "ko", "en", ""); err != nil {
		t.Fatalf("register: %v", err)
	}
	user, err := svc.Authenticate(ctx, mustLogin(t, svc, ctx, emailAddr, "password123"))
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}

	if _, err := svc.AddUserLanguage(ctx, user.ID, "zh", "en", true); err != nil {
		t.Fatalf("add chinese: %v", err)
	}

	langs, err := svc.GetUserLanguages(ctx, user.ID)
	if err != nil {
		t.Fatalf("get languages: %v", err)
	}
	if len(langs) != 2 {
		t.Fatalf("expected 2 languages, got %d", len(langs))
	}

	active, err := svc.activeUserLanguage(ctx, user.ID)
	if err != nil {
		t.Fatalf("active language: %v", err)
	}
	if active.TargetLanguage != "zh" {
		t.Fatalf("expected active zh, got %q", active.TargetLanguage)
	}

	if err := svc.SetActiveUserLanguage(ctx, user.ID, "en"); err != nil {
		t.Fatalf("set active en: %v", err)
	}
	active, err = svc.activeUserLanguage(ctx, user.ID)
	if err != nil {
		t.Fatalf("active language after switch: %v", err)
	}
	if active.TargetLanguage != "en" {
		t.Fatalf("expected active en after switch, got %q", active.TargetLanguage)
	}
}

func TestUILanguage(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("ui-lang")

	if err := svc.Register(ctx, emailAddr, "password123", "", "", "ko"); err != nil {
		t.Fatalf("register: %v", err)
	}
	user, err := svc.Authenticate(ctx, mustLogin(t, svc, ctx, emailAddr, "password123"))
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	if user.UILanguage != "ko" {
		t.Fatalf("expected ui language ko, got %q", user.UILanguage)
	}

	if err := svc.SetUILanguage(ctx, user.ID, "en"); err != nil {
		t.Fatalf("set ui language: %v", err)
	}
	lang, err := svc.GetUILanguage(ctx, user.ID)
	if err != nil {
		t.Fatalf("get ui language: %v", err)
	}
	if lang != "en" {
		t.Fatalf("expected ui language en, got %q", lang)
	}
}

func mustLogin(t *testing.T, svc *Service, ctx context.Context, email, password string) string {
	t.Helper()
	session, err := svc.Login(ctx, email, password)
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	return session.Token
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
