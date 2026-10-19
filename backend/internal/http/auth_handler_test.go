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

func TestBFFLoginCallbackSessionAndLogoutFlow(t *testing.T) {
	setup := testAuthRouterWithJWT(t)
	tokenStr := mintTestJWT(t, setup, "sub-bff-777", "bff-learner@platform.local", "google")

	var logoutCalledWith string
	mockGateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/auth/exchange":
			var body struct {
				Ticket string `json:"ticket"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body.Ticket != "v1.good-ticket" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.ExchangeResponse{
				SessionHandle: "v1.sealed-session-handle-777",
				Subject:       "sub-bff-777",
				Issuer:        setup.cfg.Issuer,
				Audience:      "project-pn",
				ExpiresIn:     28800,
			})
		case r.Method == http.MethodGet && r.URL.Path == "/auth":
			if r.Header.Get("Authorization") != "Bearer v1.sealed-session-handle-777" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Authorization", "Bearer "+tokenStr)
			w.Header().Set("X-User-Subject", "sub-bff-777")
			w.Header().Set("X-User-Issuer", setup.cfg.Issuer)
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPost && r.URL.Path == "/auth/logout":
			logoutCalledWith = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"revoked"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer mockGateway.Close()

	gwClient := auth.NewGatewayClient(mockGateway.URL+"/auth", auth.SignInShared, mockGateway.Client())
	router := NewRouter(Dependencies{
		Auth:             setup.authSvc,
		JWTVerifier:      setup.verifier,
		Gateway:          gwClient,
		PublicAppURL:     "https://pn.nacfson.cloud",
		PublicAuthOrigin: "https://auth.nacfson.cloud",
		AllowedOrigins:   []string{"https://pn.nacfson.cloud"},
		AdminLogger:      admin.NoopLogger{},
	})

	// 1. GET /api/auth/login sets __Host-pa_nonce and redirects to /oauth/start
	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusFound {
		t.Fatalf("expected 302 from /api/auth/login, got %d", loginRec.Code)
	}
	var nonceCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == "__Host-pa_nonce" {
			nonceCookie = c
			break
		}
	}
	if nonceCookie == nil || len(nonceCookie.Value) != 32 || !nonceCookie.HttpOnly || !nonceCookie.Secure || nonceCookie.MaxAge != 600 {
		t.Fatalf("invalid __Host-pa_nonce cookie: %+v", nonceCookie)
	}

	loc := loginRec.Header().Get("Location")
	if !strings.HasPrefix(loc, "https://auth.nacfson.cloud/oauth/start?return=") {
		t.Fatalf("unexpected login redirect Location: %s", loc)
	}
	// Extract pa_bind from return URL
	idx := strings.Index(loc, "pa_bind%3D")
	if idx == -1 {
		t.Fatalf("expected pa_bind in return URL: %s", loc)
	}
	paBindEncoded := loc[idx+len("pa_bind%3D"):]
	if amp := strings.Index(paBindEncoded, "%26"); amp != -1 {
		paBindEncoded = paBindEncoded[:amp]
	}

	// 2. CWE-352: Callback without cookie or with mismatched pa_bind returns 400 Bad Request
	csrfReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback?pa_bind=wrong-bind&ticket=v1.good-ticket", nil)
	csrfReq.AddCookie(nonceCookie)
	csrfRec := httptest.NewRecorder()
	router.ServeHTTP(csrfRec, csrfReq)
	if csrfRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on mismatched pa_bind, got %d", csrfRec.Code)
	}

	// 3. Callback with invalid ticket clears nonce and redirects to PublicAppURL/
	badTicketReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback?pa_bind="+paBindEncoded+"&ticket=v1.bad-ticket", nil)
	badTicketReq.AddCookie(nonceCookie)
	badTicketRec := httptest.NewRecorder()
	router.ServeHTTP(badTicketRec, badTicketReq)
	if badTicketRec.Code != http.StatusFound || badTicketRec.Header().Get("Location") != "https://pn.nacfson.cloud/" {
		t.Fatalf("expected 302 to https://pn.nacfson.cloud/, got %d %s", badTicketRec.Code, badTicketRec.Header().Get("Location"))
	}

	// 4. Valid callback provisions user, stores 32-char pickup code, and redirects to https://pn.nacfson.cloud/?code=...
	cbReq := httptest.NewRequest(http.MethodGet, "/api/auth/callback?pa_bind="+paBindEncoded+"&ticket=v1.good-ticket", nil)
	cbReq.AddCookie(nonceCookie)
	cbRec := httptest.NewRecorder()
	router.ServeHTTP(cbRec, cbReq)
	if cbRec.Code != http.StatusFound {
		t.Fatalf("expected 302 from valid callback, got %d", cbRec.Code)
	}
	cbLoc := cbRec.Header().Get("Location")
	if !strings.HasPrefix(cbLoc, "https://pn.nacfson.cloud/?code=") {
		t.Fatalf("expected redirect with ?code=, got %s", cbLoc)
	}
	pickupCode := strings.TrimPrefix(cbLoc, "https://pn.nacfson.cloud/?code=")
	if len(pickupCode) != 32 {
		t.Fatalf("expected 32-char hex pickup code, got %q", pickupCode)
	}

	// 5. CWE-770: POST /api/auth/session rejects oversized body (> 4 KB) and invalid code lengths with 400
	oversized := `{"code":"` + strings.Repeat("a", 5000) + `"}`
	overReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(oversized))
	overReq.Header.Set("Content-Type", "application/json")
	overRec := httptest.NewRecorder()
	router.ServeHTTP(overRec, overReq)
	if overRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for >4KB session body, got %d", overRec.Code)
	}

	shortReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(`{"code":"short"}`))
	shortReq.Header.Set("Content-Type", "application/json")
	shortRec := httptest.NewRecorder()
	router.ServeHTTP(shortRec, shortReq)
	if shortRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-32-char code, got %d", shortRec.Code)
	}

	// 6. Valid POST /api/auth/session returns 200 OK with v1.<session_handle>
	sessReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(`{"code":"`+pickupCode+`"}`))
	sessReq.Header.Set("Content-Type", "application/json")
	sessRec := httptest.NewRecorder()
	router.ServeHTTP(sessRec, sessReq)
	if sessRec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/auth/session, got %d body=%s", sessRec.Code, sessRec.Body.String())
	}
	var sessResp refreshResponse
	if err := json.NewDecoder(sessRec.Body).Decode(&sessResp); err != nil {
		t.Fatalf("decode session response: %v", err)
	}
	if sessResp.Token != "v1.sealed-session-handle-777" || sessResp.RefreshToken != "v1.sealed-session-handle-777" {
		t.Fatalf("unexpected session response: %+v", sessResp)
	}

	// 7. CWE-384: Replaying the same pickup code a second time returns 401 Unauthorized
	replayReq := httptest.NewRequest(http.MethodPost, "/api/auth/session", strings.NewReader(`{"code":"`+pickupCode+`"}`))
	replayReq.Header.Set("Content-Type", "application/json")
	replayRec := httptest.NewRecorder()
	router.ServeHTTP(replayRec, replayReq)
	if replayRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on replayed pickup code, got %d", replayRec.Code)
	}

	// 8. POST /api/auth/logout with Bearer v1.<session_handle> revokes handle at gateway and returns 200 {"status":"revoked"}
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.Host = "pn.nacfson.cloud"
	logoutReq.Header.Set("Authorization", "Bearer "+sessResp.Token)
	logoutReq.Header.Set("Origin", "https://pn.nacfson.cloud")
	logoutRec := httptest.NewRecorder()
	router.ServeHTTP(logoutRec, logoutReq)
	if logoutRec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/auth/logout, got %d body=%s", logoutRec.Code, logoutRec.Body.String())
	}
	var logoutBody map[string]string
	if err := json.NewDecoder(logoutRec.Body).Decode(&logoutBody); err != nil {
		t.Fatalf("decode logout response: %v", err)
	}
	if logoutBody["status"] != "revoked" {
		t.Fatalf("expected status=revoked, got %+v", logoutBody)
	}
	if logoutCalledWith != "Bearer v1.sealed-session-handle-777" {
		t.Fatalf("expected gateway logout called with Bearer v1.sealed-session-handle-777, got %q", logoutCalledWith)
	}
}

func TestBFFLogoutForwards502And503WithoutClaimingRevoked(t *testing.T) {
	for _, tc := range []struct {
		name           string
		gatewayStatus  int
		gatewayPayload string
		wantStatus     int
		wantError      string
	}{
		{
			name:           "forwards 502 when Keycloak refuses delete",
			gatewayStatus:  http.StatusBadGateway,
			gatewayPayload: `{"error":"revocation_failed","message":"Keycloak did not delete the session"}`,
			wantStatus:     http.StatusBadGateway,
			wantError:      "revocation_failed",
		},
		{
			name:           "forwards 503 when Keycloak is unreachable",
			gatewayStatus:  http.StatusServiceUnavailable,
			gatewayPayload: `{"error":"service_unavailable","message":"Keycloak unreachable"}`,
			wantStatus:     http.StatusServiceUnavailable,
			wantError:      "service_unavailable",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mockGateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.gatewayStatus)
				_, _ = w.Write([]byte(tc.gatewayPayload))
			}))
			defer mockGateway.Close()

			gwClient := auth.NewGatewayClient(mockGateway.URL+"/auth", auth.SignInShared, mockGateway.Client())
			logger := &fakeLogger{}
			handler := centralLogout(nil, logger, gwClient)

			req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
			req = req.WithContext(withAuthSession(req.Context(), authSession{
				method:     authMethodBearer,
				credential: "v1.active-session-handle",
			}))
			rec := httptest.NewRecorder()

			handler(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d body=%s", tc.wantStatus, rec.Code, rec.Body.String())
			}
			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode error body: %v", err)
			}
			if body["status"] == "revoked" {
				t.Fatalf("failed logout must never claim status=revoked: %+v", body)
			}
			if body["error"] != tc.wantError {
				t.Fatalf("expected error %q, got %+v", tc.wantError, body)
			}
			if len(rec.Result().Cookies()) != 0 {
				t.Fatalf("expected no cookie clearing on failed bearer logout, got %+v", rec.Result().Cookies())
			}
		})
	}
}

func TestPickupCodeExpiryEviction(t *testing.T) {
	h := newAuthHandler(nil, nil, nil, "https://pn.nacfson.cloud", "https://auth.nacfson.cloud", admin.NoopLogger{})
	now := time.Now().UTC()
	code := "0123456789abcdef0123456789abcdef"
	h.storePickupCode(code, pickupEntry{
		SessionHandle:    "v1.expired-handle",
		SessionExpiresAt: now.Add(time.Hour),
		ExpiresAt:        now.Add(pickupCodeTTL),
	}, now)

	// Attempting to consume after 31 seconds must fail and evict
	if _, ok := h.consumePickupCode(code, now.Add(31*time.Second)); ok {
		t.Fatal("expected expired pickup code to be rejected")
	}
}


