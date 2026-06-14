package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

func testAuthRouter(t *testing.T, requireVerified bool, oauthVerifiers map[string]auth.OAuthVerifier) (http.Handler, *auth.Service) {
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
		SessionTTL:            time.Hour,
		MagicLinkTTL:          15 * time.Minute,
		ExchangeCodeTTL:       5 * time.Minute,
		DefaultDefinitionLang: cfg.DefaultDefinitionLang,
		DefaultTargetLang:     cfg.DefaultTargetLang,
		AppPublicURL:          "http://localhost:8080",
	})
	wordsSvc := words.New(pool, enrich.NewOpenAI("", "", ""), cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	router := NewRouter(Dependencies{
		DB:                   pool,
		Words:                wordsSvc,
		Auth:                 authSvc,
		OAuthVerifiers:       oauthVerifiers,
		AllowedOrigins:       []string{"http://localhost:8081"},
		RequireEmailVerified: requireVerified,
	})
	return router, authSvc
}

func TestProtectedRoutesRequireAuth(t *testing.T) {
	router, _ := testAuthRouter(t, false, nil)

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
	router, _ := testAuthRouter(t, false, nil)
	emailAddr := uniqueEmail("http-register")
	password := "password123"

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d body=%s", regRec.Code, regRec.Body.String())
	}

	var regSession sessionResponse
	if err := json.NewDecoder(regRec.Body).Decode(&regSession); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	if regSession.Token == "" {
		t.Fatal("expected register token")
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+regSession.Token)
	meRec := httptest.NewRecorder()
	router.ServeHTTP(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("me: expected 200, got %d", meRec.Code)
	}

	loginBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody)
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d body=%s", loginRec.Code, loginRec.Body.String())
	}
}

func TestAuthRateLimitReturns429(t *testing.T) {
	router, _ := testAuthRouter(t, false, nil)

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

func TestMagicLinkE2EHTTP(t *testing.T) {
	router, authSvc := testAuthRouter(t, false, nil)
	ctx := context.Background()
	emailAddr := uniqueEmail("http-magic")

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"password123"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("register: %d", regRec.Code)
	}

	var regSession sessionResponse
	if err := json.NewDecoder(regRec.Body).Decode(&regSession); err != nil {
		t.Fatalf("decode register: %v", err)
	}
	user, err := authSvc.Authenticate(ctx, regSession.Token)
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}

	plain, err := authSvc.InsertMagicLinkTokenForTest(ctx, user.ID)
	if err != nil {
		t.Fatalf("insert magic token: %v", err)
	}

	consumeReq := httptest.NewRequest(http.MethodGet, "/api/auth/magic/consume?token="+plain, nil)
	consumeRec := httptest.NewRecorder()
	router.ServeHTTP(consumeRec, consumeReq)
	if consumeRec.Code != http.StatusFound {
		t.Fatalf("consume: expected 302, got %d body=%s", consumeRec.Code, consumeRec.Body.String())
	}
	location := consumeRec.Header().Get("Location")
	if !strings.Contains(location, "/auth/callback#code=") {
		t.Fatalf("expected fragment callback redirect, got %q", location)
	}
	code := strings.TrimPrefix(location[strings.Index(location, "#code="):], "#code=")

	exchangeBody := bytes.NewBufferString(`{"code":"` + code + `"}`)
	exchangeReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic/exchange", exchangeBody)
	exchangeRec := httptest.NewRecorder()
	router.ServeHTTP(exchangeRec, exchangeReq)
	if exchangeRec.Code != http.StatusOK {
		t.Fatalf("exchange: expected 200, got %d body=%s", exchangeRec.Code, exchangeRec.Body.String())
	}

	var exchanged sessionResponse
	if err := json.NewDecoder(exchangeRec.Body).Decode(&exchanged); err != nil {
		t.Fatalf("decode exchange: %v", err)
	}
	if exchanged.Token == "" {
		t.Fatal("expected exchanged session token")
	}
}

func TestRequireVerifiedBlocksUnverifiedLookup(t *testing.T) {
	router, _ := testAuthRouter(t, true, nil)
	emailAddr := uniqueEmail("unverified")

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"password123"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("register: %d", regRec.Code)
	}
	var regSession sessionResponse
	if err := json.NewDecoder(regRec.Body).Decode(&regSession); err != nil {
		t.Fatalf("decode register: %v", err)
	}

	lookupBody := bytes.NewBufferString(`{"text":"hello"}`)
	lookupReq := httptest.NewRequest(http.MethodPost, "/api/words/lookup", lookupBody)
	lookupReq.Header.Set("Authorization", "Bearer "+regSession.Token)
	lookupRec := httptest.NewRecorder()
	router.ServeHTTP(lookupRec, lookupReq)
	if lookupRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for unverified user, got %d", lookupRec.Code)
	}
}

func TestRequireVerifiedDisabledAllowsLookup(t *testing.T) {
	router, _ := testAuthRouter(t, false, nil)
	emailAddr := uniqueEmail("verified-off")

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"password123"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("register: %d", regRec.Code)
	}
	var regSession sessionResponse
	if err := json.NewDecoder(regRec.Body).Decode(&regSession); err != nil {
		t.Fatalf("decode register: %v", err)
	}

	lookupBody := bytes.NewBufferString(`{"text":"hello"}`)
	lookupReq := httptest.NewRequest(http.MethodPost, "/api/words/lookup", lookupBody)
	lookupReq.Header.Set("Authorization", "Bearer "+regSession.Token)
	lookupRec := httptest.NewRecorder()
	router.ServeHTTP(lookupRec, lookupReq)
	if lookupRec.Code == http.StatusForbidden {
		t.Fatalf("did not expect verification gate when disabled, got 403")
	}
}

func uniqueEmail(prefix string) string {
	return prefix + "+" + time.Now().Format("150405.000000") + "@example.com"
}

type stubOAuthVerifier struct {
	claims auth.OAuthClaims
	err    error
}

func (s stubOAuthVerifier) Verify(_ context.Context, idToken string) (auth.OAuthClaims, error) {
	if s.err != nil {
		return auth.OAuthClaims{}, s.err
	}
	if idToken == "" {
		return auth.OAuthClaims{}, errors.New("empty token")
	}
	return s.claims, nil
}

func TestOAuthGoogleNewUser(t *testing.T) {
	emailAddr := uniqueEmail("oauth-new")
	subject := "google-subject-new-" + time.Now().Format("150405.000000")
	verifiers := map[string]auth.OAuthVerifier{
		"google": stubOAuthVerifier{
			claims: auth.OAuthClaims{
				Subject:       subject,
				Email:         emailAddr,
				EmailVerified: true,
			},
		},
	}
	router, authSvc := testAuthRouter(t, false, verifiers)

	body := bytes.NewBufferString(`{"id_token":"stub-token"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/oauth/google", body)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("oauth new user: expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var session sessionResponse
	if err := json.NewDecoder(rec.Body).Decode(&session); err != nil {
		t.Fatalf("decode oauth response: %v", err)
	}
	if session.Token == "" {
		t.Fatal("expected oauth session token")
	}

	user, err := authSvc.Authenticate(context.Background(), session.Token)
	if err != nil {
		t.Fatalf("authenticate oauth session: %v", err)
	}
	if user.Email != emailAddr {
		t.Fatalf("expected email %q, got %q", emailAddr, user.Email)
	}
	if !user.IsEmailVerified() {
		t.Fatal("expected verified email for new oauth user")
	}
}

func TestOAuthGoogleIdentityReuse(t *testing.T) {
	emailAddr := uniqueEmail("oauth-reuse")
	subject := "google-subject-reuse-" + time.Now().Format("150405.000000")
	verifiers := map[string]auth.OAuthVerifier{
		"google": stubOAuthVerifier{
			claims: auth.OAuthClaims{
				Subject:       subject,
				Email:         emailAddr,
				EmailVerified: true,
			},
		},
	}
	router, authSvc := testAuthRouter(t, false, verifiers)

	firstBody := bytes.NewBufferString(`{"id_token":"first-login"}`)
	firstReq := httptest.NewRequest(http.MethodPost, "/api/auth/oauth/google", firstBody)
	firstRec := httptest.NewRecorder()
	router.ServeHTTP(firstRec, firstReq)
	if firstRec.Code != http.StatusOK {
		t.Fatalf("first oauth login: %d body=%s", firstRec.Code, firstRec.Body.String())
	}
	var firstSession sessionResponse
	if err := json.NewDecoder(firstRec.Body).Decode(&firstSession); err != nil {
		t.Fatalf("decode first session: %v", err)
	}
	firstUser, err := authSvc.Authenticate(context.Background(), firstSession.Token)
	if err != nil {
		t.Fatalf("authenticate first session: %v", err)
	}

	secondBody := bytes.NewBufferString(`{"id_token":"second-login"}`)
	secondReq := httptest.NewRequest(http.MethodPost, "/api/auth/oauth/google", secondBody)
	secondRec := httptest.NewRecorder()
	router.ServeHTTP(secondRec, secondReq)
	if secondRec.Code != http.StatusOK {
		t.Fatalf("second oauth login: %d body=%s", secondRec.Code, secondRec.Body.String())
	}
	var secondSession sessionResponse
	if err := json.NewDecoder(secondRec.Body).Decode(&secondSession); err != nil {
		t.Fatalf("decode second session: %v", err)
	}
	secondUser, err := authSvc.Authenticate(context.Background(), secondSession.Token)
	if err != nil {
		t.Fatalf("authenticate second session: %v", err)
	}
	if firstUser.ID != secondUser.ID {
		t.Fatalf("expected same user on identity reuse, got %q vs %q", firstUser.ID, secondUser.ID)
	}
}

func TestOAuthGoogleVerifiedEmailLink(t *testing.T) {
	emailAddr := uniqueEmail("oauth-link")
	password := "password123"
	subject := "google-subject-link-" + time.Now().Format("150405.000000")
	verifiers := map[string]auth.OAuthVerifier{
		"google": stubOAuthVerifier{
			claims: auth.OAuthClaims{
				Subject:       subject,
				Email:         emailAddr,
				EmailVerified: true,
			},
		},
	}
	router, authSvc := testAuthRouter(t, false, verifiers)

	regBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", regBody)
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)
	if regRec.Code != http.StatusCreated {
		t.Fatalf("register: %d body=%s", regRec.Code, regRec.Body.String())
	}

	oauthBody := bytes.NewBufferString(`{"id_token":"link-token"}`)
	oauthReq := httptest.NewRequest(http.MethodPost, "/api/auth/oauth/google", oauthBody)
	oauthRec := httptest.NewRecorder()
	router.ServeHTTP(oauthRec, oauthReq)
	if oauthRec.Code != http.StatusOK {
		t.Fatalf("oauth link: expected 200, got %d body=%s", oauthRec.Code, oauthRec.Body.String())
	}

	var oauthSession sessionResponse
	if err := json.NewDecoder(oauthRec.Body).Decode(&oauthSession); err != nil {
		t.Fatalf("decode oauth session: %v", err)
	}
	oauthUser, err := authSvc.Authenticate(context.Background(), oauthSession.Token)
	if err != nil {
		t.Fatalf("authenticate oauth session: %v", err)
	}

	loginBody := bytes.NewBufferString(`{"email":"` + emailAddr + `","password":"` + password + `"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", loginBody)
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("password login after link: %d", loginRec.Code)
	}
	var loginSession sessionResponse
	if err := json.NewDecoder(loginRec.Body).Decode(&loginSession); err != nil {
		t.Fatalf("decode login session: %v", err)
	}
	passwordUser, err := authSvc.Authenticate(context.Background(), loginSession.Token)
	if err != nil {
		t.Fatalf("authenticate password session: %v", err)
	}
	if oauthUser.ID != passwordUser.ID {
		t.Fatalf("expected linked accounts to share user id, got oauth=%q password=%q", oauthUser.ID, passwordUser.ID)
	}
	if !oauthUser.IsEmailVerified() {
		t.Fatal("expected email verified after oauth link")
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
