package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"project-pn/internal/auth"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/email"
	"project-pn/internal/enrich"
	"project-pn/internal/migrations"
	"project-pn/internal/words"
)

func testAuthRouter(t *testing.T) (http.Handler, *auth.Service) {
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

	cfg := config.Load()
	authSvc := auth.New(pool, email.NewLog(), auth.Options{
		SessionTTL:             time.Hour,
		EmailVerificationTTL:   24 * time.Hour,
		DefaultDefinitionLang:  cfg.DefaultDefinitionLang,
		DefaultTargetLang:      cfg.DefaultTargetLang,
		DefaultUILang:          cfg.UILang,
		AllowedDefinitionLangs: cfg.AllowedDefinitionLangs,
		AllowedTargetLangs:     cfg.AllowedTargetLangs,
		AllowedUILangs:         cfg.AllowedUILangs,
		ForceDefinitionLang:    cfg.ForceDefinitionLang,
		ForceTargetLang:        cfg.ForceTargetLang,
		ForceUILang:            cfg.ForceUILang,
		AppPublicURL:           "http://localhost:8080",
	})
	wordsSvc := words.New(pool, enrich.NewOpenAI("", "", ""), cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	router := NewRouter(Dependencies{
		DB:             pool,
		Words:          wordsSvc,
		Auth:           authSvc,
		AllowedOrigins: []string{"http://localhost:8081"},
	})
	return router, authSvc
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

func TestRegisterAndLogin(t *testing.T) {
	router, authSvc := testAuthRouter(t)
	ctx := context.Background()
	emailAddr := uniqueEmail("http-register")
	password := "password123"

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusNoContent {
		t.Fatalf("register: expected 204, got %d body=%s", regRec.Code, regRec.Body.String())
	}

	loginBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody)
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	if loginRec.Code != http.StatusForbidden {
		t.Fatalf("login before verification: expected 403, got %d body=%s", loginRec.Code, loginRec.Body.String())
	}

	plain, err := authSvc.InsertVerificationTokenForTest(ctx, emailAddr)
	if err != nil {
		t.Fatalf("insert verification token: %v", err)
	}

	consumeReq := httptest.NewRequest(http.MethodGet, "/api/auth/verify-email?token="+plain, nil)
	consumeRec := httptest.NewRecorder()
	router.ServeHTTP(consumeRec, consumeReq)
	if consumeRec.Code != http.StatusFound {
		t.Fatalf("verify-email: expected 302, got %d body=%s", consumeRec.Code, consumeRec.Body.String())
	}
	location := consumeRec.Header().Get("Location")
	if !strings.Contains(location, "verified=true") {
		t.Fatalf("expected verified redirect, got %q", location)
	}

	loginBody2 := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	loginReq2 := httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody2)
	loginRec2 := httptest.NewRecorder()
	router.ServeHTTP(loginRec2, loginReq2)
	if loginRec2.Code != http.StatusOK {
		t.Fatalf("login after verification: expected 200, got %d body=%s", loginRec2.Code, loginRec2.Body.String())
	}

	var session sessionResponse
	if err := json.NewDecoder(loginRec2.Body).Decode(&session); err != nil {
		t.Fatalf("decode login session: %v", err)
	}
	if session.Token == "" {
		t.Fatal("expected login session token")
	}

	user, err := authSvc.Authenticate(ctx, session.Token)
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}
	if !user.IsEmailVerified() {
		t.Fatal("expected verified user")
	}
}

func TestAuthRateLimitReturns429(t *testing.T) {
	router, _ := testAuthRouter(t)

	for i := 0; i < 12; i++ {
		body := bytes.NewBufferString(`{"email":"ratelimit@example.com","password":"password123"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code == http.StatusTooManyRequests {
			return
		}
	}
	t.Fatal("expected 429 from auth rate limiter")
}

func TestRequireVerifiedBlocksUnverifiedLookup(t *testing.T) {
	router, _ := testAuthRouter(t)
	emailAddr := uniqueEmail("unverified")

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"password123"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusNoContent {
		t.Fatalf("register: %d", regRec.Code)
	}

	lookupBody := bytes.NewBufferString(`{"text":"hello"}`)
	lookupReq := httptest.NewRequest(http.MethodPost, "/api/words/lookup", lookupBody)
	lookupRec := httptest.NewRecorder()
	router.ServeHTTP(lookupRec, lookupReq)
	if lookupRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without session, got %d", lookupRec.Code)
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
