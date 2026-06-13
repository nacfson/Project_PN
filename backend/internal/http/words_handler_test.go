package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
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

func validationRouter(t *testing.T) (http.Handler, string) {
	t.Helper()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for words handler HTTP tests")
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
		SessionTTL:            time.Hour,
		MagicLinkTTL:          15 * time.Minute,
		ExchangeCodeTTL:       5 * time.Minute,
		DefaultDefinitionLang: cfg.DefaultDefinitionLang,
		DefaultTargetLang:     cfg.DefaultTargetLang,
		AppPublicURL:          cfg.AppPublicURL,
	})
	wordsSvc := words.New(pool, enrich.NewOpenAI("", "", ""), cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)
	router := NewRouter(Dependencies{
		DB:             pool,
		Words:          wordsSvc,
		Auth:           authSvc,
		AllowedOrigins: []string{"http://localhost:8081"},
	})

	emailAddr := uniqueEmail("words-validation")
	session, err := authSvc.Register(ctx, emailAddr, "password123", "", "")
	if err != nil {
		t.Fatalf("register test user: %v", err)
	}
	return router, session.Token
}

func authRequest(t *testing.T, method, path, body, token string) *http.Request {
	t.Helper()
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func TestLookupRejectsForceWithoutPosOrWordID(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodPost, "/api/words/lookup", `{"text":"charge","force":true,"part_of_speech":"Any"}`, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d for force+Any+no word_id, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestLookupRejectsEmptyText(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodPost, "/api/words/lookup", `{"text":"  "}`, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d for empty text, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestAddLearningItemRequiresWordSenseID(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodPost, "/api/learning-items", `{}`, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d for missing word_sense_id, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestCorsPreflightAllowsConfiguredOrigin(t *testing.T) {
	t.Parallel()

	svc := words.New(nil, nil, "00000000-0000-0000-0000-000000000001", "en", "ko")
	authSvc := auth.New(nil, email.NewLog(), auth.Options{
		SessionTTL:            time.Hour,
		MagicLinkTTL:          15 * time.Minute,
		ExchangeCodeTTL:       5 * time.Minute,
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		AppPublicURL:          "http://localhost:8080",
	})
	router := NewRouter(Dependencies{
		Words:          svc,
		Auth:           authSvc,
		AllowedOrigins: []string{"http://localhost:8081"},
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/words/lookup", nil)
	req.Header.Set("Origin", "http://localhost:8081")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "Authorization, Content-Type")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:8081" {
		t.Fatalf("expected allow-origin header for configured origin, got %q", got)
	}
	allowedHeaders := rec.Header().Get("Access-Control-Allow-Headers")
	if !strings.Contains(allowedHeaders, "Authorization") {
		t.Fatalf("expected Authorization in allow-headers, got %q", allowedHeaders)
	}
}

func TestApiRoutesAbsentWithoutWordsService(t *testing.T) {
	t.Parallel()

	authSvc := auth.New(nil, email.NewLog(), auth.Options{
		SessionTTL:            time.Hour,
		MagicLinkTTL:          15 * time.Minute,
		ExchangeCodeTTL:       5 * time.Minute,
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		AppPublicURL:          "http://localhost:8080",
	})
	router := NewRouter(Dependencies{Auth: authSvc})

	req := httptest.NewRequest(http.MethodPost, "/api/words/lookup", strings.NewReader(`{"text":"x"}`))
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected %d when words service is absent, got %d", http.StatusNotFound, rec.Code)
	}
}

func TestRegisterReturnsTokenJSON(t *testing.T) {
	router, _ := testAuthRouter(t, false, nil)
	emailAddr := uniqueEmail("json-shape")

	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(
		`{"email":"`+emailAddr+`","password":"password123"}`,
	))
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("register: %d", regRec.Code)
	}

	var payload map[string]any
	if err := json.NewDecoder(regRec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload["token"] == "" {
		t.Fatal("expected token field")
	}
}
