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

	"github.com/jackc/pgx/v5/pgxpool"

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
	router, token, _, _ := validationRouterWithPool(t)
	return router, token
}

func validationRouterWithPool(t *testing.T) (http.Handler, string, *pgxpool.Pool, *auth.Service) {
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
	return router, session.Token, pool, authSvc
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

func TestListLearningItemsPaginatesAndFilters(t *testing.T) {
	router, token, pool, authSvc := validationRouterWithPool(t)
	ctx := context.Background()

	user, err := authSvc.Authenticate(ctx, token)
	if err != nil {
		t.Fatalf("authenticate primary user: %v", err)
	}
	otherSession, err := authSvc.Register(ctx, uniqueEmail("words-other"), "password123", "", "")
	if err != nil {
		t.Fatalf("register other user: %v", err)
	}
	otherUser, err := authSvc.Authenticate(ctx, otherSession.Token)
	if err != nil {
		t.Fatalf("authenticate other user: %v", err)
	}

	base := time.Date(2026, 6, 14, 12, 0, 0, 0, time.UTC)
	suffix := time.Now().Format("150405.000000")
	alpha := "alpha-" + suffix
	bravo := "bravo-" + suffix
	charlie := "charlie-" + suffix
	insertLearningItemFixture(t, pool, user.ID, alpha, "first active", base.Add(time.Minute), false)
	insertLearningItemFixture(t, pool, user.ID, bravo, "second active", base.Add(2*time.Minute), false)
	insertLearningItemFixture(t, pool, user.ID, charlie, "third active", base.Add(3*time.Minute), false)
	insertLearningItemFixture(t, pool, user.ID, "archived-"+suffix, "archived item", base.Add(4*time.Minute), true)
	insertLearningItemFixture(t, pool, otherUser.ID, "other-"+suffix, "other user's item", base.Add(5*time.Minute), false)

	firstReq := authRequest(t, http.MethodGet, "/api/learning-items?limit=2&descending=true", "", token)
	firstRec := httptest.NewRecorder()
	router.ServeHTTP(firstRec, firstReq)
	if firstRec.Code != http.StatusOK {
		t.Fatalf("first page: expected 200, got %d body=%s", firstRec.Code, firstRec.Body.String())
	}

	var firstPage words.LearningItemsPage
	if err := json.NewDecoder(firstRec.Body).Decode(&firstPage); err != nil {
		t.Fatalf("decode first page: %v", err)
	}
	if len(firstPage.Items) != 2 {
		t.Fatalf("expected 2 first-page items, got %d", len(firstPage.Items))
	}
	if firstPage.Items[0].Lemma != charlie || firstPage.Items[1].Lemma != bravo {
		t.Fatalf("unexpected descending order: %#v", firstPage.Items)
	}
	if firstPage.NextCursor == nil || *firstPage.NextCursor == "" {
		t.Fatal("expected next cursor")
	}

	secondReq := authRequest(t, http.MethodGet, "/api/learning-items?limit=2&descending=true&cursor="+*firstPage.NextCursor, "", token)
	secondRec := httptest.NewRecorder()
	router.ServeHTTP(secondRec, secondReq)
	if secondRec.Code != http.StatusOK {
		t.Fatalf("second page: expected 200, got %d body=%s", secondRec.Code, secondRec.Body.String())
	}
	var secondPage words.LearningItemsPage
	if err := json.NewDecoder(secondRec.Body).Decode(&secondPage); err != nil {
		t.Fatalf("decode second page: %v", err)
	}
	if len(secondPage.Items) != 1 || secondPage.Items[0].Lemma != alpha {
		t.Fatalf("unexpected second page: %#v", secondPage.Items)
	}
	if secondPage.NextCursor != nil {
		t.Fatalf("did not expect cursor on final page, got %q", *secondPage.NextCursor)
	}

	ascendingReq := authRequest(t, http.MethodGet, "/api/learning-items?limit=2&descending=false", "", token)
	ascendingRec := httptest.NewRecorder()
	router.ServeHTTP(ascendingRec, ascendingReq)
	if ascendingRec.Code != http.StatusOK {
		t.Fatalf("ascending page: expected 200, got %d body=%s", ascendingRec.Code, ascendingRec.Body.String())
	}
	var ascendingPage words.LearningItemsPage
	if err := json.NewDecoder(ascendingRec.Body).Decode(&ascendingPage); err != nil {
		t.Fatalf("decode ascending page: %v", err)
	}
	if len(ascendingPage.Items) != 2 || ascendingPage.Items[0].Lemma != alpha || ascendingPage.Items[1].Lemma != bravo {
		t.Fatalf("unexpected ascending order: %#v", ascendingPage.Items)
	}

	searchReq := authRequest(t, http.MethodGet, "/api/learning-items?limit=10&q=alph", "", token)
	searchRec := httptest.NewRecorder()
	router.ServeHTTP(searchRec, searchReq)
	if searchRec.Code != http.StatusOK {
		t.Fatalf("search page: expected 200, got %d body=%s", searchRec.Code, searchRec.Body.String())
	}
	var searchPage words.LearningItemsPage
	if err := json.NewDecoder(searchRec.Body).Decode(&searchPage); err != nil {
		t.Fatalf("decode search page: %v", err)
	}
	if len(searchPage.Items) != 1 || searchPage.Items[0].Lemma != alpha {
		t.Fatalf("unexpected search results: %#v", searchPage.Items)
	}

	emptySearchReq := authRequest(t, http.MethodGet, "/api/learning-items?limit=10&q=missing-"+suffix, "", token)
	emptySearchRec := httptest.NewRecorder()
	router.ServeHTTP(emptySearchRec, emptySearchReq)
	if emptySearchRec.Code != http.StatusOK {
		t.Fatalf("empty search page: expected 200, got %d body=%s", emptySearchRec.Code, emptySearchRec.Body.String())
	}
	var emptySearchPage words.LearningItemsPage
	if err := json.NewDecoder(emptySearchRec.Body).Decode(&emptySearchPage); err != nil {
		t.Fatalf("decode empty search page: %v", err)
	}
	if len(emptySearchPage.Items) != 0 {
		t.Fatalf("expected no search results, got %#v", emptySearchPage.Items)
	}
}

func TestParseListLearningItemsParamsCapsLimit(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/learning-items?limit=1000&descending=false&q=%20alph%20", nil)
	params, err := parseListLearningItemsParams(req)
	if err != nil {
		t.Fatalf("parse params: %v", err)
	}
	if params.Limit != 100 {
		t.Fatalf("expected capped limit 100, got %d", params.Limit)
	}
	if params.Descending {
		t.Fatal("expected descending=false")
	}
	if params.Search != "alph" {
		t.Fatalf("expected trimmed search query, got %q", params.Search)
	}
}

func TestParseListLearningItemsParamsRejectsInvalidValues(t *testing.T) {
	for _, path := range []string{
		"/api/learning-items?limit=0",
		"/api/learning-items?limit=abc",
		"/api/learning-items?descending=later",
		"/api/learning-items?cursor=not-a-cursor",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if _, err := parseListLearningItemsParams(req); err == nil {
			t.Fatalf("%s: expected parse error", path)
		}
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

func insertLearningItemFixture(t *testing.T, pool *pgxpool.Pool, userID, lemma, definition string, addedAt time.Time, archived bool) {
	t.Helper()
	ctx := context.Background()

	var wordID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun')
		returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatalf("insert word fixture %q: %v", lemma, err)
	}

	var senseID string
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition_language_code, definition, short_definition, cefr_level, meaning_order)
		values ($1::uuid, 'ko', $2, $2, 'A1', 1)
		returning id::text
	`, wordID, definition).Scan(&senseID); err != nil {
		t.Fatalf("insert sense fixture %q: %v", lemma, err)
	}

	var userWordSenseID string
	var archivedAt *time.Time
	if archived {
		value := addedAt.Add(time.Minute)
		archivedAt = &value
	}
	if err := pool.QueryRow(ctx, `
		insert into user_word_senses (user_id, word_sense_id, added_at, archived_at)
		values ($1::uuid, $2::uuid, $3, $4)
		returning id::text
	`, userID, senseID, addedAt, archivedAt).Scan(&userWordSenseID); err != nil {
		t.Fatalf("insert user word sense fixture %q: %v", lemma, err)
	}

	if _, err := pool.Exec(ctx, `
		insert into review_states (user_word_sense_id, due_at)
		values ($1::uuid, $2)
	`, userWordSenseID, addedAt); err != nil {
		t.Fatalf("insert review state fixture %q: %v", lemma, err)
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
