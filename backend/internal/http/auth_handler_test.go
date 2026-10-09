package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
	"project-pn/internal/migrations"
	"project-pn/internal/words"
)

type testRouterSetup struct {
	router   http.Handler
	authSvc  *auth.Service
	verifier *auth.JWTVerifier
	privKey  *rsa.PrivateKey
	cfg      auth.JWTVerifierConfig
}

func testAuthRouter(t *testing.T) (http.Handler, *auth.Service) {
	s := testAuthRouterWithJWT(t)
	return s.router, s.authSvc
}

func testAuthRouterWithJWT(t *testing.T) testRouterSetup {
	t.Helper()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for auth HTTP tests")
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

	cfg := config.Load()
	authSvc := auth.New(pool, auth.Options{
		DefaultDefinitionLang:  cfg.DefaultDefinitionLang,
		DefaultTargetLang:      cfg.DefaultTargetLang,
		DefaultUILang:          cfg.UILang,
		AllowedDefinitionLangs: cfg.AllowedDefinitionLangs,
		AllowedTargetLangs:     cfg.AllowedTargetLangs,
		AllowedUILangs:         cfg.AllowedUILangs,
		ForceDefinitionLang:    cfg.ForceDefinitionLang,
		ForceTargetLang:        cfg.ForceTargetLang,
		ForceUILang:            cfg.ForceUILang,
	})
	wordsSvc := words.New(pool, enrich.NewOpenAI("", "", ""), admin.NoopLogger{}, learninglog.NoopLogger{}, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	pubJWK, err := jwk.Import(privKey.Public())
	if err != nil {
		t.Fatalf("import jwk: %v", err)
	}
	_ = pubJWK.Set(jwk.KeyIDKey, "test-kid")
	_ = pubJWK.Set(jwk.AlgorithmKey, jwa.RS256())

	keySet := jwk.NewSet()
	_ = keySet.AddKey(pubJWK)

	jwtCfg := auth.JWTVerifierConfig{
		Issuer:      "https://auth.nacfson.cloud/realms/platform",
		Audience:    "project-pn",
		AllowedAlgs: []string{"RS256"},
		ClockSkew:   1 * time.Minute,
	}
	verifier := auth.NewJWTVerifier(jwtCfg)
	verifier.SetStaticJWKS(keySet)

	router := NewRouter(Dependencies{
		DB:             pool,
		Words:          wordsSvc,
		Auth:           authSvc,
		JWTVerifier:    verifier,
		AuthDevBypass:  false,
		AllowedOrigins: []string{"http://localhost:8081"},
		AdminLogger:    admin.NoopLogger{},
	})

	return testRouterSetup{
		router:   router,
		authSvc:  authSvc,
		verifier: verifier,
		privKey:  privKey,
		cfg:      jwtCfg,
	}
}

func mintTestJWT(t *testing.T, s testRouterSetup, sub, email, provider string) string {
	t.Helper()

	builder := jwt.NewBuilder().
		Issuer(s.cfg.Issuer).
		Audience([]string{s.cfg.Audience}).
		Subject(sub).
		Expiration(time.Now().Add(10 * time.Minute)).
		IssuedAt(time.Now().Add(-1 * time.Minute)).
		Claim("typ", "Bearer")

	if email != "" {
		builder.Claim("email", email)
	}
	if provider != "" {
		builder.Claim("identity_provider", provider)
	}

	tok, err := builder.Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}

	headers := jws.NewHeaders()
	_ = headers.Set("kid", "test-kid")
	_ = headers.Set("typ", "JWT")

	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256(), s.privKey, jws.WithProtectedHeaders(headers)))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return string(signed)
}

func TestRefreshSessionReturnsGone(t *testing.T) {
	setup := testAuthRouterWithJWT(t)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", strings.NewReader(`{"refresh_token":"old-refresh"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	setup.router.ServeHTTP(rec, req)

	// Deprecated per 001-gateway-jwt-auth contracts/auth-api-surface.md
	if rec.Code != http.StatusGone {
		t.Fatalf("expected 410 Gone, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestJWTIssuerMeLoadsLocalProfile(t *testing.T) {
	setup := testAuthRouterWithJWT(t)
	token := mintTestJWT(t, setup, "sub-learner-101", "learner@platform.local", "google")

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	setup.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var profile meResponse
	if err := json.NewDecoder(rec.Body).Decode(&profile); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if profile.Email != "learner@platform.local" {
		t.Fatalf("expected learner email, got %+v", profile)
	}
	if len(profile.LinkedProviders) != 1 {
		t.Fatalf("expected 1 linked provider, got %d", len(profile.LinkedProviders))
	}
	lp := profile.LinkedProviders[0]
	if lp.SignInMethod != "google" || lp.Subject != "sub-learner-101" {
		t.Fatalf("expected google sign in method and subject, got %+v", lp)
	}
}

func TestOrdinaryUserDeniedUndeclaredOperations(t *testing.T) {
	setup := testAuthRouterWithJWT(t)
	token := mintTestJWT(t, setup, "sub-learner-102", "ordinary@platform.local", "google")

	// Attempting an undeclared admin endpoint must return 404 Not Found (or 403 Forbidden)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	setup.router.ServeHTTP(rec, req)

	if rec.Code == http.StatusOK {
		t.Fatalf("undeclared admin endpoint must not return 200, got %d", rec.Code)
	}
}

func TestLanguageOptionsEndpoint(t *testing.T) {
	router, _ := testAuthRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/language-options", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("language-options: expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var opts auth.LanguageOptions
	if err := json.NewDecoder(rec.Body).Decode(&opts); err != nil {
		t.Fatalf("decode language-options: %v", err)
	}
	if opts.Defaults.TargetLanguage == "" || opts.Defaults.DefinitionLanguage == "" {
		t.Fatalf("expected non-empty defaults: %+v", opts.Defaults)
	}
}

func TestProtectedRoutesRequireAuth(t *testing.T) {
	router, _ := testAuthRouter(t)

	for _, path := range []string{"/api/words/lookup", "/api/learning-items", "/api/auth/me"} {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"text":"x"}`))
		if path == "/api/auth/me" {
			req = httptest.NewRequest(http.MethodGet, path, nil)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected 401, got %d", path, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/learning-items", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET /api/learning-items: expected 401, got %d", rec.Code)
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

func uniqueEmail(prefix string) string {
	return prefix + "+" + time.Now().Format("150405.000000") + "@example.com"
}

type noopMagicLinks struct{}

func (noopMagicLinks) SendMagicLink(context.Context, string, string) error { return nil }

