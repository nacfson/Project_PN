package httpapi

import (
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

	"project-pn/internal/admin"
	"project-pn/internal/auth"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/enrich"
	"project-pn/internal/migrations"
	"project-pn/internal/words"
)

func testAuthRouter(t *testing.T) (http.Handler, *auth.Service) {
	return testAuthRouterWithCentral(t, nil)
}

func testAuthRouterWithCentral(t *testing.T, central *auth.CentralClient) (http.Handler, *auth.Service) {
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

	if _, err := pool.Exec(ctx, `TRUNCATE TABLE users, words, word_senses, decks, user_languages, user_word_senses, review_states, review_attempts CASCADE;`); err != nil {
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
	wordsSvc := words.New(pool, enrich.NewOpenAI("", "", ""), admin.NoopLogger{}, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	router := NewRouter(Dependencies{
		DB:             pool,
		Words:          wordsSvc,
		Auth:           authSvc,
		CentralAuth:    central,
		AllowedOrigins: []string{"http://localhost:8081"},
		AdminLogger:    admin.NoopLogger{},
	})
	return router, authSvc
}

func TestCookieAuthMeLoadsLocalProfile(t *testing.T) {
	var centralUserRequests int
	centralServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/internal/cookie-session" {
			t.Fatalf("unexpected central path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer internal-secret" {
			t.Fatalf("unexpected central auth header %q", r.Header.Get("Authorization"))
		}
		cookie, err := r.Cookie(auth.CentralSessionCookieName)
		if err != nil || cookie.Value != "cookie-value" {
			t.Fatalf("unexpected forwarded cookie: %v %#v", err, cookie)
		}
		centralUserRequests++
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"user_id":"central-cookie-user","email":"cookie-user@example.com","is_admin":false,"expires_at":"2099-01-01T00:00:00Z"}`))
	}))
	defer centralServer.Close()

	router, _ := testAuthRouterWithCentral(t, auth.NewCentralClientWithInternalAuth("", centralServer.URL, "internal-secret", centralServer.Client()))
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.CentralSessionCookieName, Value: "cookie-value"})
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var profile meResponse
	if err := json.NewDecoder(rec.Body).Decode(&profile); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if profile.Email != "cookie-user@example.com" {
		t.Fatalf("expected cookie user profile, got %+v", profile)
	}
	if centralUserRequests != 1 {
		t.Fatalf("expected one central cookie request, got %d", centralUserRequests)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != csrfCookieName || cookies[0].Value == "" {
		t.Fatalf("expected csrf cookie, got %v", cookies)
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
