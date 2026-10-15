package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

type fakePlatformUserEnsurer struct {
	user auth.User
}

func (f fakePlatformUserEnsurer) EnsurePlatformUser(_ context.Context, issuer, subject, email, signInMethod string) (auth.AuthResult, error) {
	return auth.AuthResult{
		User:            f.user,
		SessionProvider: signInMethod,
	}, nil
}

type testAuthSetup struct {
	verifier *auth.JWTVerifier
	privKey  *rsa.PrivateKey
	cfg      auth.JWTVerifierConfig
}

func setupTestVerifier(t *testing.T) testAuthSetup {
	t.Helper()

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	pubJWK, err := jwk.Import(privKey.Public())
	if err != nil {
		t.Fatalf("failed to import public JWK: %v", err)
	}
	_ = pubJWK.Set(jwk.KeyIDKey, "test-kid")
	_ = pubJWK.Set(jwk.AlgorithmKey, jwa.RS256())

	keySet := jwk.NewSet()
	_ = keySet.AddKey(pubJWK)

	cfg := auth.JWTVerifierConfig{
		Issuer:      "https://auth.nacfson.cloud/realms/platform",
		Audience:    "project-pn",
		AllowedAlgs: []string{"RS256"},
		ClockSkew:   1 * time.Minute,
	}

	verifier := auth.NewJWTVerifier(cfg)
	verifier.SetStaticJWKS(keySet)

	return testAuthSetup{
		verifier: verifier,
		privKey:  privKey,
		cfg:      cfg,
	}
}

func mintTokenForMiddleware(t *testing.T, setup testAuthSetup, iss, aud, sub, typ, headerTyp string, exp time.Time, key *rsa.PrivateKey) string {
	t.Helper()

	if key == nil {
		key = setup.privKey
	}

	builder := jwt.NewBuilder().
		Issuer(iss).
		Audience([]string{aud}).
		Subject(sub).
		Expiration(exp).
		IssuedAt(time.Now().Add(-1 * time.Minute))

	if typ != "" {
		builder.Claim("typ", typ)
	}

	tok, err := builder.Build()
	if err != nil {
		t.Fatalf("failed to build token: %v", err)
	}

	headers := jws.NewHeaders()
	_ = headers.Set("kid", "test-kid")
	if headerTyp != "" {
		_ = headers.Set("typ", headerTyp)
	}

	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256(), key, jws.WithProtectedHeaders(headers)))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return string(signed)
}

func TestAuthMiddleware_ValidProjectJWT(t *testing.T) {
	setup := setupTestVerifier(t)
	expectedUser := auth.User{
		ID:    "user-uuid-1234",
		Email: "learner@project-pn.local",
	}
	ensurer := fakePlatformUserEnsurer{user: expectedUser}
	mw := authMiddleware(setup.verifier, ensurer, false, nil, admin.NoopLogger{})

	tokenStr := mintTokenForMiddleware(t, setup, setup.cfg.Issuer, setup.cfg.Audience, "user-sub-1234", "Bearer", "JWT", time.Now().Add(10*time.Minute), nil)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	// Inject spoofed headers to assert they are stripped
	req.Header.Set("X-User-Subject", "attacker-sub")
	req.Header.Set("X-User-Issuer", "attacker-issuer")
	req.Header.Set("X-User-Roles", "admin")

	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok || user.ID != expectedUser.ID {
			t.Fatalf("expected user %s, got %+v", expectedUser.ID, user)
		}
		// Confirm forged headers were stripped
		for _, h := range []string{"X-User-Subject", "X-User-Issuer", "X-User-Roles"} {
			if r.Header.Get(h) != "" {
				t.Fatalf("expected header %s to be stripped, got %q", h, r.Header.Get(h))
			}
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
}

func TestAuthMiddleware_RejectMatrix(t *testing.T) {
	setup := setupTestVerifier(t)
	ensurer := fakePlatformUserEnsurer{user: auth.User{ID: "user-1"}}
	mw := authMiddleware(setup.verifier, ensurer, false, nil, admin.NoopLogger{})

	otherKey, _ := rsa.GenerateKey(rand.Reader, 2048)

	testCases := []struct {
		name          string
		authHeader    string
		customHeaders map[string]string
	}{
		{
			name:       "Missing Bearer header",
			authHeader: "",
		},
		{
			name:       "Spoofed headers without Bearer",
			authHeader: "",
			customHeaders: map[string]string{
				"X-User-Subject": "attacker-sub",
				"X-User-Issuer":  setup.cfg.Issuer,
			},
		},
		{
			name:       "Wrong audience",
			authHeader: "Bearer " + mintTokenForMiddleware(t, setup, setup.cfg.Issuer, "wrong-aud", "sub-1", "Bearer", "JWT", time.Now().Add(10*time.Minute), nil),
		},
		{
			name:       "Wrong issuer",
			authHeader: "Bearer " + mintTokenForMiddleware(t, setup, "https://wrong.issuer/realms/platform", setup.cfg.Audience, "sub-1", "Bearer", "JWT", time.Now().Add(10*time.Minute), nil),
		},
		{
			name:       "Bad signature",
			authHeader: "Bearer " + mintTokenForMiddleware(t, setup, setup.cfg.Issuer, setup.cfg.Audience, "sub-1", "Bearer", "JWT", time.Now().Add(10*time.Minute), otherKey),
		},
		{
			name:       "Expired token",
			authHeader: "Bearer " + mintTokenForMiddleware(t, setup, setup.cfg.Issuer, setup.cfg.Audience, "sub-1", "Bearer", "JWT", time.Now().Add(-10*time.Minute), nil),
		},
		{
			name:       "ID token substituted",
			authHeader: "Bearer " + mintTokenForMiddleware(t, setup, setup.cfg.Issuer, setup.cfg.Audience, "sub-1", "ID", "ID", time.Now().Add(10*time.Minute), nil),
		},
		{
			name:       "Legacy mock-dev-token rejected in production",
			authHeader: "Bearer mock-dev-token",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/words/lookup", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			for k, v := range tc.customHeaders {
				req.Header.Set(k, v)
			}
			rec := httptest.NewRecorder()

			mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t.Fatal("protected handler must not be executed")
			})).ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
			}

			var errResp struct {
				Code string `json:"code"`
			}
			_ = json.Unmarshal(rec.Body.Bytes(), &errResp)
			if errResp.Code != "AUTH-101" {
				t.Fatalf("expected code AUTH-101, got %q", errResp.Code)
			}
		})
	}
}

func TestAuthMiddleware_DevBypass(t *testing.T) {
	setup := setupTestVerifier(t)
	devUser := auth.User{
		ID:    "00000000-0000-0000-0000-000000000001",
		Email: "dev@project-pn.local",
	}
	ensurer := fakePlatformUserEnsurer{user: devUser}

	// 1. With devBypass=true, mock-dev-token succeeds
	devMW := authMiddleware(setup.verifier, ensurer, true, nil, admin.NoopLogger{})
	req := httptest.NewRequest(http.MethodGet, "/api/words/lookup", nil)
	req.Header.Set("Authorization", "Bearer mock-dev-token")
	rec := httptest.NewRecorder()

	devMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := userFromContext(r.Context())
		if !ok || u.ID != devUser.ID {
			t.Fatalf("expected dev user %s, got %+v", devUser.ID, u)
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for dev bypass, got %d", rec.Code)
	}

	// 2. With devBypass=false (production), mock-dev-token is rejected
	prodMW := authMiddleware(setup.verifier, ensurer, false, nil, admin.NoopLogger{})
	req2 := httptest.NewRequest(http.MethodGet, "/api/words/lookup", nil)
	req2.Header.Set("Authorization", "Bearer mock-dev-token")
	rec2 := httptest.NewRecorder()

	prodMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("dev token must not be accepted in prod")
	})).ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for prod with mock-dev-token, got %d", rec2.Code)
	}
}

func TestAuthMiddleware_CookieGatewayConfirmation(t *testing.T) {
	setup := setupTestVerifier(t)
	expectedUser := auth.User{
		ID:    "cookie-user-1234",
		Email: "cookie@project-pn.local",
	}
	ensurer := fakePlatformUserEnsurer{user: expectedUser}

	tokenStr := mintTokenForMiddleware(t, setup, setup.cfg.Issuer, setup.cfg.Audience, "cookie-sub-1234", "Bearer", "JWT", time.Now().Add(10*time.Minute), nil)

	mockGateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("PLATFORM_SESSION")
		if err != nil || cookie.Value != "valid-cookie" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Authorization", "Bearer "+tokenStr)
		w.Header().Set("X-User-Subject", "cookie-sub-1234")
		w.Header().Set("X-User-Issuer", setup.cfg.Issuer)
		w.WriteHeader(http.StatusOK)
	}))
	defer mockGateway.Close()

	gatewayClient := auth.NewGatewayClient(mockGateway.URL, auth.SignInShared, mockGateway.Client())
	mw := authMiddleware(setup.verifier, ensurer, false, gatewayClient, admin.NoopLogger{})

	// 1. Valid cookie succeeds and injects user
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Host = "pn.example.com"
	req.AddCookie(&http.Cookie{Name: "PLATFORM_SESSION", Value: "valid-cookie"})
	rec := httptest.NewRecorder()

	var capturedSession authSession
	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := userFromContext(r.Context())
		if !ok || u.ID != expectedUser.ID {
			t.Fatalf("expected user %s, got %+v", expectedUser.ID, u)
		}
		s, sOk := authSessionFromContext(r.Context())
		if !sOk {
			t.Fatal("expected authSession in context")
		}
		capturedSession = s
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid cookie, got %d", rec.Code)
	}
	if capturedSession.method != authMethodCookie {
		t.Fatalf("expected session method cookie, got %v", capturedSession.method)
	}

	// 2. Invalid cookie is rejected with 401
	badReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	badReq.Host = "pn.example.com"
	badReq.AddCookie(&http.Cookie{Name: "PLATFORM_SESSION", Value: "bad-cookie"})
	badRec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be called on bad cookie")
	})).ServeHTTP(badRec, badReq)

	if badRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for bad cookie, got %d", badRec.Code)
	}
}

func TestAuthMiddleware_BearerV1SessionHandle(t *testing.T) {
	setup := setupTestVerifier(t)
	expectedUser := auth.User{
		ID:    "v1-user-1234",
		Email: "v1@project-pn.local",
	}
	ensurer := fakePlatformUserEnsurer{user: expectedUser}

	tokenStr := mintTokenForMiddleware(t, setup, setup.cfg.Issuer, setup.cfg.Audience, "v1-sub-1234", "Bearer", "JWT", time.Now().Add(10*time.Minute), nil)

	mockGateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer v1.valid-handle" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Authorization", "Bearer "+tokenStr)
		w.Header().Set("X-User-Subject", "v1-sub-1234")
		w.Header().Set("X-User-Issuer", setup.cfg.Issuer)
		w.Header().Set("X-Refreshed-Session-Handle", "v1.rotated-handle")
		w.WriteHeader(http.StatusOK)
	}))
	defer mockGateway.Close()

	gatewayClient := auth.NewGatewayClient(mockGateway.URL, auth.SignInShared, mockGateway.Client())
	mw := authMiddleware(setup.verifier, ensurer, false, gatewayClient, admin.NoopLogger{})

	// 1. Valid Bearer v1.<session_handle> confirms via gateway, verifies JWT, sets X-Refreshed-Session-Handle, and preserves v1. credential in authSession
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Host = "pn.nacfson.cloud"
	req.Header.Set("Authorization", "Bearer v1.valid-handle")
	rec := httptest.NewRecorder()

	var capturedSession authSession
	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := userFromContext(r.Context())
		if !ok || u.ID != expectedUser.ID {
			t.Fatalf("expected user %s, got %+v", expectedUser.ID, u)
		}
		s, sOk := authSessionFromContext(r.Context())
		if !sOk {
			t.Fatal("expected authSession in context")
		}
		capturedSession = s
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid v1 handle, got %d", rec.Code)
	}
	if rec.Header().Get("X-Refreshed-Session-Handle") != "v1.rotated-handle" {
		t.Fatalf("expected X-Refreshed-Session-Handle 'v1.rotated-handle', got %q", rec.Header().Get("X-Refreshed-Session-Handle"))
	}
	if capturedSession.credential != "v1.valid-handle" {
		t.Fatalf("expected preserved credential 'v1.valid-handle', got %q", capturedSession.credential)
	}

	// 2. Invalid Bearer v1.<session_handle> is rejected with 401
	badReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	badReq.Host = "pn.nacfson.cloud"
	badReq.Header.Set("Authorization", "Bearer v1.invalid-handle")
	badRec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be called on invalid v1 handle")
	})).ServeHTTP(badRec, badReq)

	if badRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid v1 handle, got %d", badRec.Code)
	}
}

